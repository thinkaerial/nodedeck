use anyhow::{bail, Result};
use serde::Deserialize;
use serde_json::Value;

use super::sftp;
use super::ssh::{self, ConnectionParams};
use super::ssh_pool::SshPool;

/// Typed fleet operations (spec section 3.7/12) — deliberately not "run any
/// shell command a caller hands us" as the default shape, even though
/// `run_command` exists as one specific, explicit task type a user chooses.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TaskKind {
    RunCommand { command: String },
    RestartService { service: String },
    CheckDisk,
    CollectDiagnostics,
    DownloadLogs { remote_path: String, local_path: String },
    UploadFile { local_path: String, remote_path: String },
}

pub fn parse_task_kind(task_type: &str, config_json: &str) -> Result<TaskKind> {
    let mut value: Value = serde_json::from_str(config_json).unwrap_or(Value::Object(Default::default()));
    if let Value::Object(map) = &mut value {
        map.insert("type".to_string(), Value::String(task_type.to_string()));
    }
    Ok(serde_json::from_value(value)?)
}

pub fn is_destructive(task_type: &str) -> bool {
    matches!(task_type, "restart_service" | "run_command")
}

/// Runs one task on one device, reusing that device's pooled SSH connection.
/// Returns a short human-readable summary on success.
pub async fn run_one(pool: &SshPool, params: &ConnectionParams, kind: &TaskKind) -> Result<String> {
    match kind {
        TaskKind::RunCommand { command } => {
            let result = ssh::exec_pooled(pool, params, command).await?;
            if result.exit_code != 0 {
                bail!("exit code {}: {}", result.exit_code, result.stderr.trim());
            }
            Ok(result.stdout.trim().to_string())
        }
        TaskKind::RestartService { service } => {
            let cmd = format!("sudo systemctl restart {service} && systemctl is-active {service}");
            let result = ssh::exec_pooled(pool, params, &cmd).await?;
            if result.exit_code != 0 {
                bail!("restart failed: {}", result.stderr.trim());
            }
            Ok(format!("{service}: {}", result.stdout.trim()))
        }
        TaskKind::CheckDisk => {
            let result = ssh::exec_pooled(pool, params, "df -h /").await?;
            Ok(result.stdout.trim().to_string())
        }
        TaskKind::CollectDiagnostics => {
            let cmd = "echo === uname ===; uname -a; echo === uptime ===; uptime; echo === disk ===; df -h /; echo === mem ===; free -m";
            let result = ssh::exec_pooled(pool, params, cmd).await?;
            Ok(result.stdout.trim().to_string())
        }
        TaskKind::DownloadLogs { remote_path, local_path } => {
            sftp::download_file(pool, params, remote_path, local_path, |_, _| {}).await?;
            Ok(format!("saved to {local_path}"))
        }
        TaskKind::UploadFile { local_path, remote_path } => {
            sftp::upload_file(pool, params, local_path, remote_path, |_, _| {}).await?;
            Ok(format!("uploaded to {remote_path}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_run_command_config() {
        let kind = parse_task_kind("run_command", r#"{"command": "uptime"}"#).unwrap();
        match kind {
            TaskKind::RunCommand { command } => assert_eq!(command, "uptime"),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn parses_check_disk_with_no_config() {
        let kind = parse_task_kind("check_disk", "{}").unwrap();
        assert!(matches!(kind, TaskKind::CheckDisk));
    }

    #[test]
    fn destructive_flags_match_spec() {
        assert!(is_destructive("restart_service"));
        assert!(is_destructive("run_command"));
        assert!(!is_destructive("check_disk"));
        assert!(!is_destructive("collect_diagnostics"));
    }
}
