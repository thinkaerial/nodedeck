use app_lib::core::serial;

fn main() -> anyhow::Result<()> {
    let ports = serial::list_ports()?;
    println!("{} USB serial port(s) found:", ports.len());
    for p in &ports {
        println!("  {} — {}", p.path, p.label);
    }
    Ok(())
}
