use app_lib::core::mdns;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("browsing mDNS for 4s...");
    let entries = mdns::browse(std::time::Duration::from_secs(4)).await?;
    println!("{} entries found:", entries.len());
    for e in &entries {
        println!("  {} ({}) port={} addrs={:?}", e.hostname, e.service_type, e.port, e.addresses);
    }
    Ok(())
}
