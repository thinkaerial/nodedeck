//! Proves the connection pool actually avoids repeated SSH handshakes:
//! times N sequential execs against a real device, unpooled vs pooled.
//! Run with: NODEDECK_HOST=... NODEDECK_USER=... NODEDECK_PASS=... cargo run --example pool_speed_check

use app_lib::core::{ssh, ssh_pool::SshPool};
use std::time::Instant;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let host = std::env::var("NODEDECK_HOST").expect("set NODEDECK_HOST");
    let port: u16 = std::env::var("NODEDECK_PORT").unwrap_or_else(|_| "22".into()).parse()?;
    let username = std::env::var("NODEDECK_USER").expect("set NODEDECK_USER");
    let password = std::env::var("NODEDECK_PASS").expect("set NODEDECK_PASS");
    let params = ssh::ConnectionParams { host, port, username, password };

    const N: usize = 5;

    let start = Instant::now();
    for i in 0..N {
        let mut session = ssh::connect(&params).await?;
        let r = ssh::exec(&mut session, "echo hi").await?;
        ssh::disconnect(&mut session).await.ok();
        println!("unpooled #{i}: {:?}", r.stdout.trim());
    }
    let unpooled_elapsed = start.elapsed();
    println!("UNPOOLED total for {N} calls: {unpooled_elapsed:?}");

    let pool = SshPool::default();
    let start = Instant::now();
    for i in 0..N {
        let r = ssh::exec_pooled(&pool, &params, "echo hi").await?;
        println!("pooled #{i}: {:?}", r.stdout.trim());
    }
    let pooled_elapsed = start.elapsed();
    println!("POOLED total for {N} calls: {pooled_elapsed:?}");

    println!(
        "speedup: {:.1}x",
        unpooled_elapsed.as_secs_f64() / pooled_elapsed.as_secs_f64()
    );
    Ok(())
}
