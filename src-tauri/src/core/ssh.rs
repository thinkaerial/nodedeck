use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{bail, Result};
use async_trait::async_trait;
use russh::keys::key;
use russh::{client, Channel, ChannelMsg, Disconnect};
use serde::{Deserialize, Serialize};

use super::known_hosts;
use super::ssh_pool::SshPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionParams {
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub password: String,
    /// When set, authenticates with this private key file instead of
    /// `password`. Path to an OpenSSH-format key (id_rsa, id_ed25519, …).
    #[serde(default)]
    pub private_key_path: Option<String>,
    #[serde(default)]
    pub private_key_passphrase: Option<String>,
}

#[derive(Debug, Clone)]
enum HostKeyOutcome {
    /// No fingerprint was on file for this host — trusted on first use and
    /// recorded, matching how most SSH clients behave on a genuine first
    /// connection. Real protection kicks in on the *next* connection: if the
    /// key ever changes after this, it's a Mismatch, not silently re-trusted.
    TrustedNew(String),
    Matched,
    Mismatch { expected: String, got: String },
}

/// Verifies the server's host key against a local known-hosts store
/// (`~/Library/Application Support/nodedeck/known_hosts.json` on macOS) instead
/// of accepting anything, per requirements section 3.3/8.
pub struct HostKeyVerifyingHandler {
    host: String,
    port: u16,
    outcome: Arc<Mutex<Option<HostKeyOutcome>>>,
}

#[async_trait]
impl client::Handler for HostKeyVerifyingHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &key::PublicKey,
    ) -> std::result::Result<bool, Self::Error> {
        let fingerprint = format!("SHA256:{}", server_public_key.fingerprint());
        let stored = known_hosts::get(&self.host, self.port);

        let (accept, outcome) = match stored {
            None => {
                let _ = known_hosts::trust(&self.host, self.port, &fingerprint);
                (true, HostKeyOutcome::TrustedNew(fingerprint))
            }
            Some(expected) if expected == fingerprint => (true, HostKeyOutcome::Matched),
            Some(expected) => (
                false,
                HostKeyOutcome::Mismatch { expected, got: fingerprint },
            ),
        };

        *self.outcome.lock().unwrap() = Some(outcome);
        Ok(accept)
    }
}

const CONNECT_TIMEOUT: Duration = Duration::from_secs(6);

/// `~` isn't expanded by the filesystem — only shells do that — so a path
/// like `~/.ssh/id_ed25519` typed into the Add Device form would otherwise
/// fail with "no such file". This mirrors what any real SSH client does.
fn expand_tilde(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest).to_string_lossy().to_string();
        }
    }
    path.to_string()
}

pub async fn connect(params: &ConnectionParams) -> Result<client::Handle<HostKeyVerifyingHandler>> {
    let config = Arc::new(client::Config {
        inactivity_timeout: Some(Duration::from_secs(15)),
        ..<_>::default()
    });

    let outcome: Arc<Mutex<Option<HostKeyOutcome>>> = Arc::new(Mutex::new(None));
    let handler = HostKeyVerifyingHandler {
        host: params.host.clone(),
        port: params.port,
        outcome: outcome.clone(),
    };

    // `client::connect` has no built-in timeout — against an unreachable host
    // (silently dropped packets, no RST) it can hang for the OS's default TCP
    // connect timeout, which is 60-75s on macOS. Every caller (terminal open,
    // file browse, monitor poll, reconnect) goes through this, so an offline
    // device would otherwise make the whole app feel frozen.
    let connect_result = tokio::time::timeout(
        CONNECT_TIMEOUT,
        client::connect(config, (params.host.as_str(), params.port), handler),
    )
    .await;

    let mut session = match connect_result {
        Err(_) => bail!("connection to {}:{} timed out", params.host, params.port),
        Ok(Err(e)) => {
            if let Some(HostKeyOutcome::Mismatch { expected, got }) = outcome.lock().unwrap().clone() {
                bail!(
                    "host key changed for {}:{} — expected {expected}, got {got}. This could mean the device was reimaged, or a network attack. If you're certain this is expected, remove the saved key for this device in Credentials & Security and reconnect.",
                    params.host,
                    params.port
                );
            }
            return Err(e.into());
        }
        Ok(Ok(s)) => s,
    };

    if let Some(HostKeyOutcome::TrustedNew(fingerprint)) = outcome.lock().unwrap().clone() {
        log::info!(
            "trusted new host key for {}:{} — {fingerprint}",
            params.host,
            params.port
        );
    }

    let authenticated = if let Some(key_path) = &params.private_key_path {
        let expanded_path = expand_tilde(key_path);
        let key_pair = russh::keys::load_secret_key(&expanded_path, params.private_key_passphrase.as_deref())
            .map_err(|e| anyhow::anyhow!("failed to load private key {expanded_path}: {e}"))?;
        tokio::time::timeout(
            CONNECT_TIMEOUT,
            session.authenticate_publickey(&params.username, Arc::new(key_pair)),
        )
        .await
        .map_err(|_| anyhow::anyhow!("authentication to {}:{} timed out", params.host, params.port))??
    } else {
        tokio::time::timeout(
            CONNECT_TIMEOUT,
            session.authenticate_password(&params.username, &params.password),
        )
        .await
        .map_err(|_| anyhow::anyhow!("authentication to {}:{} timed out", params.host, params.port))??
    };

    if !authenticated {
        bail!("authentication failed for {}@{}", params.username, params.host);
    }

    Ok(session)
}

#[derive(Debug, Clone, Serialize)]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Runs one command on an already-open channel and collects its full output.
async fn exec_on_channel(mut channel: Channel<client::Msg>, command: &str) -> Result<ExecResult> {
    channel.exec(true, command).await?;

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut exit_code = -1;

    loop {
        let Some(msg) = channel.wait().await else {
            break;
        };
        match msg {
            ChannelMsg::Data { ref data } => stdout.extend_from_slice(data),
            ChannelMsg::ExtendedData { ref data, ext } if ext == 1 => {
                stderr.extend_from_slice(data)
            }
            ChannelMsg::ExitStatus { exit_status } => {
                exit_code = exit_status as i32;
            }
            _ => {}
        }
    }

    Ok(ExecResult {
        stdout: String::from_utf8_lossy(&stdout).to_string(),
        stderr: String::from_utf8_lossy(&stderr).to_string(),
        exit_code,
    })
}

/// Runs one command over a fresh, throwaway connection. Only used where a
/// connection genuinely shouldn't be reused (e.g. the initial "test
/// connection" check before a device is saved).
pub async fn exec(
    session: &mut client::Handle<HostKeyVerifyingHandler>,
    command: &str,
) -> Result<ExecResult> {
    let channel = session.channel_open_session().await?;
    exec_on_channel(channel, command).await
}

/// Runs one command reusing the device's pooled connection — the fast path
/// used by everything after the initial connect (monitor polls, quick
/// commands, processes/logs).
pub async fn exec_pooled(pool: &SshPool, params: &ConnectionParams, command: &str) -> Result<ExecResult> {
    let channel = pool.open_channel(params).await?;
    exec_on_channel(channel, command).await
}

pub async fn disconnect(session: &mut client::Handle<HostKeyVerifyingHandler>) -> Result<()> {
    session
        .disconnect(Disconnect::ByApplication, "", "en")
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expands_leading_tilde() {
        let home = dirs::home_dir().unwrap();
        assert_eq!(
            expand_tilde("~/.ssh/id_ed25519"),
            home.join(".ssh/id_ed25519").to_string_lossy().to_string()
        );
    }

    #[test]
    fn leaves_absolute_paths_untouched() {
        assert_eq!(expand_tilde("/etc/ssh/keys/id_rsa"), "/etc/ssh/keys/id_rsa");
    }

    #[test]
    fn leaves_bare_tilde_without_slash_untouched() {
        // "~otheruser/..." isn't handled (matches most simple ~-expansion
        // implementations) — only the current user's "~/" form is supported.
        assert_eq!(expand_tilde("~otheruser/id_rsa"), "~otheruser/id_rsa");
    }
}
