use anyhow::{bail, Result};
use serde::Serialize;
use std::time::Duration;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

const TOOL_TIMEOUT: Duration = Duration::from_secs(25);

/// Runs a local network CLI tool with a hard wall-clock cap — regardless of
/// how the tool itself behaves (a hung resolver, an unresponsive hop), the
/// command always returns within TOOL_TIMEOUT rather than hanging the caller.
async fn run(program: &str, args: &[&str]) -> Result<CommandOutput> {
    // kill_on_drop ensures that if the timeout below fires and we abandon the
    // wait_with_output future, the child process is actually killed rather
    // than left running as an orphan.
    let child = Command::new(program).args(args).kill_on_drop(true).spawn()?;

    let output = match tokio::time::timeout(TOOL_TIMEOUT, child.wait_with_output()).await {
        Ok(result) => result?,
        Err(_) => bail!("{program} timed out after {}s", TOOL_TIMEOUT.as_secs()),
    };

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// Local network utilities — these run on the machine NodeDeck is installed on,
/// not over SSH to a managed device (see requirements section 3.7).
pub async fn ping(target: &str) -> Result<CommandOutput> {
    if cfg!(target_os = "windows") {
        run("ping", &["-n", "4", target]).await
    } else {
        run("ping", &["-c", "4", "-t", "5", target]).await
    }
}

pub async fn dns_lookup(target: &str) -> Result<CommandOutput> {
    run("nslookup", &[target]).await
}

pub async fn arp_table() -> Result<CommandOutput> {
    if cfg!(target_os = "windows") {
        run("arp", &["-a"]).await
    } else {
        run("arp", &["-a"]).await
    }
}

pub async fn port_check(target: &str, port: u16) -> Result<CommandOutput> {
    match tokio::time::timeout(
        std::time::Duration::from_millis(1500),
        tokio::net::TcpStream::connect((target, port)),
    )
    .await
    {
        Ok(Ok(_)) => Ok(CommandOutput {
            stdout: format!("Connection to {target} port {port} succeeded."),
            stderr: String::new(),
            exit_code: 0,
        }),
        Ok(Err(e)) => Ok(CommandOutput {
            stdout: String::new(),
            stderr: format!("Connection to {target} port {port} failed: {e}"),
            exit_code: 1,
        }),
        Err(_) => Ok(CommandOutput {
            stdout: String::new(),
            stderr: format!("Connection to {target} port {port} timed out."),
            exit_code: 1,
        }),
    }
}

pub async fn traceroute(target: &str) -> Result<CommandOutput> {
    if cfg!(target_os = "windows") {
        run("tracert", &[target]).await
    } else {
        run("traceroute", &["-m", "15", "-w", "2", target]).await
    }
}
