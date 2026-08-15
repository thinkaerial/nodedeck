use tauri::State;

use crate::core::monitor::{self, MonitorSnapshot};
use crate::core::ssh::ConnectionParams;
use crate::core::ssh_pool::SshPool;

#[tauri::command]
pub async fn monitor_snapshot(pool: State<'_, SshPool>, params: ConnectionParams) -> Result<MonitorSnapshot, String> {
    monitor::snapshot(&pool, &params).await.map_err(|e| e.to_string())
}
