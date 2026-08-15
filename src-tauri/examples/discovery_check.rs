//! Verifies core::discovery against the real LAN (read-only: TCP connect probes
//! + local ARP cache read, no packets sent to any device beyond a SYN).
//! Run with: cargo run --example discovery_check [cidr]

use app_lib::core::discovery;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cidr = std::env::args()
        .nth(1)
        .or_else(discovery::default_cidr)
        .expect("pass a CIDR or ensure a default route exists");

    println!("default_cidr() = {:?}", discovery::default_cidr());
    println!("scanning {cidr}…");

    let found = discovery::scan(&cidr).await?;
    for d in &found {
        println!(
            "{}\tssh_open={}\tlatency={:?}ms\tmac={:?}\tvendor={:?}",
            d.ip, d.ssh_open, d.latency_ms, d.mac, d.vendor
        );
    }
    println!("{} device(s) found", found.len());
    Ok(())
}
