use std::collections::HashMap;
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

use anyhow::{bail, Result};
use futures::stream::{self, StreamExt};
use serde::Serialize;
use tokio::net::TcpStream;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct DiscoveredDevice {
    pub ip: String,
    pub mac: Option<String>,
    pub vendor: Option<String>,
    pub ssh_open: bool,
    pub latency_ms: Option<u64>,
}

/// Best-effort local primary IPv4, used to pre-fill a sensible default CIDR.
/// Opens a UDP "connection" (no packets sent for a plain connect+local_addr)
/// to a public address purely to ask the OS which local interface would be used.
pub fn local_ipv4() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    match socket.local_addr().ok()?.ip() {
        std::net::IpAddr::V4(v4) => Some(v4),
        _ => None,
    }
}

pub fn default_cidr() -> Option<String> {
    let ip = local_ipv4()?;
    let octets = ip.octets();
    Some(format!("{}.{}.{}.0/24", octets[0], octets[1], octets[2]))
}

fn parse_cidr(cidr: &str) -> Result<(u32, u8)> {
    let (base, prefix) = cidr.split_once('/').unwrap_or((cidr, "24"));
    let base: Ipv4Addr = base.parse()?;
    let prefix: u8 = prefix.parse()?;
    if prefix < 22 {
        bail!("CIDR range too large — use /22 or smaller (max ~1000 hosts)");
    }
    Ok((u32::from(base), prefix))
}

/// Very small OUI prefix table for vendors relevant to this product
/// (companion computers), not a full IEEE OUI database.
fn vendor_for_mac(mac: &str) -> Option<&'static str> {
    let prefix = mac.to_lowercase().get(0..8)?.to_string();
    let table: &[(&str, &str)] = &[
        ("b8:27:eb", "Raspberry Pi Foundation"),
        ("dc:a6:32", "Raspberry Pi Trading Ltd"),
        ("e4:5f:01", "Raspberry Pi Trading Ltd"),
        ("28:cd:c1", "Raspberry Pi Trading Ltd"),
        ("d8:3a:dd", "Raspberry Pi Trading Ltd"),
        ("00:04:4b", "NVIDIA"),
        ("48:b0:2d", "NVIDIA"),
    ];
    table
        .iter()
        .find(|(p, _)| *p == prefix)
        .map(|(_, vendor)| *vendor)
}

async fn read_arp_table() -> HashMap<String, String> {
    let mut map = HashMap::new();
    let Ok(output) = Command::new("arp").arg("-a").output().await else {
        return map;
    };
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        // macOS/Linux format: "? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ..."
        if let (Some(ip_start), Some(ip_end)) = (line.find('('), line.find(')')) {
            let ip = line[ip_start + 1..ip_end].to_string();
            if let Some(at_pos) = line.find(" at ") {
                let rest = &line[at_pos + 4..];
                if let Some(mac) = rest.split_whitespace().next() {
                    if mac.contains(':') {
                        map.insert(ip, mac.to_string());
                    }
                }
            }
        }
    }
    map
}

pub async fn scan(cidr: &str) -> Result<Vec<DiscoveredDevice>> {
    let (base, prefix) = parse_cidr(cidr)?;
    let host_bits = 32 - prefix as u32;
    let count = 1u32 << host_bits;
    let network = base & (!0u32 << host_bits);

    let ips: Vec<Ipv4Addr> = (1..count.saturating_sub(1))
        .map(|i| Ipv4Addr::from(network + i))
        .collect();

    log::info!(
        "discovery::scan cidr={cidr} network={} host_count={}",
        Ipv4Addr::from(network),
        ips.len()
    );

    let probes = stream::iter(ips.into_iter().map(|ip| async move {
        let addr = SocketAddr::from((ip, 22));
        let start = std::time::Instant::now();
        let (ssh_open, alive) = tokio::join!(
            async {
                tokio::time::timeout(Duration::from_millis(400), TcpStream::connect(addr))
                    .await
                    .map(|r| r.is_ok())
                    .unwrap_or(false)
            },
            ping_once(ip)
        );
        (ip, ssh_open, alive, start.elapsed().as_millis() as u64)
    }))
    .buffer_unordered(64)
    .collect::<Vec<_>>()
    .await;

    let reachable_count = probes.iter().filter(|(_, ssh, alive, _)| *ssh || *alive).count();
    log::info!("discovery::scan complete: {reachable_count}/{} hosts reachable", probes.len());

    let arp = read_arp_table().await;

    let mut devices: Vec<DiscoveredDevice> = probes
        .into_iter()
        .filter(|(_, ssh_open, alive, _)| *ssh_open || *alive)
        .map(|(ip, ssh_open, _, latency)| {
            let ip_str = ip.to_string();
            let mac = arp.get(&ip_str).cloned();
            let vendor = mac.as_deref().and_then(vendor_for_mac).map(|s| s.to_string());
            DiscoveredDevice {
                ip: ip_str,
                mac,
                vendor,
                ssh_open,
                latency_ms: Some(latency),
            }
        })
        .collect();

    devices.sort_by(|a, b| a.ip.cmp(&b.ip));
    Ok(devices)
}

/// General liveness check (any device, not just SSH) via the system `ping`
/// binary — a single ICMP echo, platform-specific flags. Used so the
/// scanner surfaces every reachable host (phones, laptops, etc.), not just
/// SSH-capable companion computers; `ssh_open` on each result still tells
/// you which ones this app can actually manage.
async fn ping_once(ip: Ipv4Addr) -> bool {
    let ip_str = ip.to_string();
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("ping");
        c.args(["-n", "1", "-w", "400", &ip_str]);
        c
    } else if cfg!(target_os = "macos") {
        let mut c = Command::new("ping");
        c.args(["-c", "1", "-W", "400", &ip_str]);
        c
    } else {
        // Linux: -W is whole seconds, not milliseconds.
        let mut c = Command::new("ping");
        c.args(["-c", "1", "-W", "1", &ip_str]);
        c
    };
    cmd.kill_on_drop(true);
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());
    tokio::time::timeout(Duration::from_millis(500), cmd.status())
        .await
        .ok()
        .and_then(|r| r.ok())
        .map(|status| status.success())
        .unwrap_or(false)
}
