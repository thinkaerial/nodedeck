use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::core::sftp::{self, SftpEntry};
use crate::core::ssh::ConnectionParams;
use crate::core::ssh_pool::SshPool;

/// Read-only directory listing, reusing the device's pooled connection.
#[tauri::command]
pub async fn sftp_list_dir(
    pool: State<'_, SshPool>,
    params: ConnectionParams,
    path: String,
) -> Result<Vec<SftpEntry>, String> {
    sftp::list_dir(&pool, &params, &path).await.map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
struct TransferProgressPayload<'a> {
    transfer_id: &'a str,
    sent: u64,
    total: u64,
}

#[tauri::command]
pub async fn sftp_upload(
    app: AppHandle,
    pool: State<'_, SshPool>,
    params: ConnectionParams,
    local_path: String,
    remote_path: String,
    transfer_id: String,
) -> Result<(), String> {
    sftp::upload_file(&pool, &params, &local_path, &remote_path, |sent, total| {
        let _ = app.emit(
            "transfer:progress",
            TransferProgressPayload { transfer_id: &transfer_id, sent, total },
        );
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_download(
    app: AppHandle,
    pool: State<'_, SshPool>,
    params: ConnectionParams,
    remote_path: String,
    local_path: String,
    transfer_id: String,
) -> Result<(), String> {
    sftp::download_file(&pool, &params, &remote_path, &local_path, |sent, total| {
        let _ = app.emit(
            "transfer:progress",
            TransferProgressPayload { transfer_id: &transfer_id, sent, total },
        );
    })
    .await
    .map_err(|e| e.to_string())
}
