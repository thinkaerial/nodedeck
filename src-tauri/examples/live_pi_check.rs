//! Ad-hoc verification against a real device, exercising the exact same
//! core::ssh / core::monitor / core::sftp functions the Tauri commands call.
//! Read-only: only `exec` (fixed inspection commands) and `sftp::list_dir` are
//! used — no write/create/delete path exists anywhere in this crate.
//!
//! Run with:
//!   NODEDECK_HOST=... NODEDECK_USER=... NODEDECK_PASS=... \
//!     cargo run --example live_pi_check
//! Credentials are read from the environment only; nothing is written to disk.

use app_lib::core::{monitor, sftp, ssh, ssh_pool::SshPool};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let host = std::env::var("NODEDECK_HOST").expect("set NODEDECK_HOST");
    let port: u16 = std::env::var("NODEDECK_PORT")
        .unwrap_or_else(|_| "22".into())
        .parse()?;
    let username = std::env::var("NODEDECK_USER").expect("set NODEDECK_USER");
    let password = std::env::var("NODEDECK_PASS").expect("set NODEDECK_PASS");

    let params = ssh::ConnectionParams { host, port, username, password };
    let pool = SshPool::default();

    println!("== ssh::connect + exec (identification probe) ==");
    let mut session = ssh::connect(&params).await?;
    let result = ssh::exec(&mut session, "whoami && hostname && uname -a && uptime").await?;
    ssh::disconnect(&mut session).await.ok();
    println!("exit_code={}", result.exit_code);
    println!("{}", result.stdout);

    println!("== core::monitor::snapshot ==");
    let snap = monitor::snapshot(&pool, &params).await?;
    println!(
        "load_1m={} mem={}/{}MB disk={}/{} ({}%) temp={:?}C uptime={}s",
        snap.load_1m,
        snap.mem_used_mb,
        snap.mem_total_mb,
        snap.disk_used,
        snap.disk_total,
        snap.disk_used_pct,
        snap.temp_c,
        snap.uptime_seconds
    );

    println!("== core::sftp::list_dir(\".\") — read-only ==");
    let entries = sftp::list_dir(&pool, &params, ".").await?;
    for e in &entries {
        println!(
            "{}{}\t{}",
            if e.is_dir { "d " } else { "- " },
            e.name,
            e.size.map(|s| s.to_string()).unwrap_or_default()
        );
    }

    println!("\nAll checks completed with no write/create/delete calls made.");
    Ok(())
}
