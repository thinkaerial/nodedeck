use std::collections::HashMap;
use std::time::Duration;

use anyhow::Result;
use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct MdnsEntry {
    pub hostname: String,
    pub addresses: Vec<String>,
    pub port: u16,
    pub service_type: String,
}

/// Companion-computer-relevant service types — not a general-purpose mDNS
/// browser. `_ssh._tcp` covers most Linux boards (Raspberry Pi OS advertises
/// this out of the box); the others catch general-purpose "what's this host"
/// advertisements some devices publish.
const SERVICE_TYPES: &[&str] = &["_ssh._tcp.local.", "_workstation._tcp.local.", "_device-info._tcp.local."];

pub async fn browse(timeout: Duration) -> Result<Vec<MdnsEntry>> {
    let daemon = ServiceDaemon::new()?;
    let mut receivers = Vec::new();
    for ty in SERVICE_TYPES {
        receivers.push((*ty, daemon.browse(ty)?));
    }

    let mut found: HashMap<String, MdnsEntry> = HashMap::new();
    let deadline = tokio::time::Instant::now() + timeout;

    while tokio::time::Instant::now() < deadline {
        for (ty, rx) in &receivers {
            while let Ok(event) = rx.try_recv() {
                if let ServiceEvent::ServiceResolved(info) = event {
                    if !info.is_valid() {
                        continue;
                    }
                    found.insert(
                        info.host.clone(),
                        MdnsEntry {
                            hostname: info.host.clone(),
                            addresses: info.addresses.iter().map(|a| a.to_string()).collect(),
                            port: info.port,
                            service_type: (*ty).to_string(),
                        },
                    );
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    for (ty, _) in &receivers {
        let _ = daemon.stop_browse(ty);
    }
    let _ = daemon.shutdown();

    let mut entries: Vec<_> = found.into_values().collect();
    entries.sort_by(|a, b| a.hostname.cmp(&b.hostname));
    Ok(entries)
}
