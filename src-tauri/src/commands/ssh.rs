use russh::ChannelMsg;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::core::ssh::{self, ConnectionParams};
use crate::core::ssh_pool::SshPool;
use crate::state::{PtyHandle, PtyInput, PtyRegistry};

#[derive(Debug, Clone, Serialize)]
pub struct TestConnectionResult {
    pub output: String,
    pub exit_code: i32,
}

/// Connects, runs a small read-only identification probe. Uses a fresh
/// throwaway connection (not the pool) since this runs before a device is
/// saved — nothing to keep warm yet.
#[tauri::command]
pub async fn ssh_test_connection(params: ConnectionParams) -> Result<TestConnectionResult, String> {
    let mut session = ssh::connect(&params).await.map_err(|e| e.to_string())?;
    let result = ssh::exec(&mut session, "whoami && hostname && uname -a")
        .await
        .map_err(|e| e.to_string())?;
    ssh::disconnect(&mut session).await.ok();
    Ok(TestConnectionResult {
        output: result.stdout,
        exit_code: result.exit_code,
    })
}

/// Runs a command reusing the device's pooled connection — fast after the
/// first call, since it skips the TCP+SSH handshake.
#[tauri::command]
pub async fn ssh_exec(
    pool: State<'_, SshPool>,
    params: ConnectionParams,
    command: String,
) -> Result<ssh::ExecResult, String> {
    ssh::exec_pooled(&pool, &params, &command)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
struct PtyDataPayload<'a> {
    session_id: &'a str,
    data: String,
}

#[derive(Clone, Serialize)]
struct PtyEventPayload<'a> {
    session_id: &'a str,
}

/// Opens a long-lived interactive shell (real PTY, not one-shot exec) and streams
/// its output back as `pty:data` events. Reuses the device's pooled connection —
/// opening a Terminal after Files/Monitor already connected is near-instant.
#[tauri::command]
pub async fn ssh_pty_open(
    app: AppHandle,
    registry: State<'_, PtyRegistry>,
    pool: State<'_, SshPool>,
    params: ConnectionParams,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let (input_tx, mut input_rx) = tokio::sync::mpsc::unbounded_channel::<PtyInput>();

    registry
        .0
        .lock()
        .unwrap()
        .insert(session_id.clone(), PtyHandle { input_tx });

    let sid = session_id.clone();
    let app_handle = app.clone();
    let pool = pool.inner().clone();

    tauri::async_runtime::spawn(async move {
        let mut channel = match pool.open_channel(&params).await {
            Ok(c) => c,
            Err(e) => {
                let _ = app_handle.emit("pty:error", (sid.clone(), e.to_string()));
                registry_cleanup(&app_handle, &sid);
                return;
            }
        };

        if let Err(e) = channel
            .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
            .await
        {
            let _ = app_handle.emit("pty:error", (sid.clone(), e.to_string()));
            registry_cleanup(&app_handle, &sid);
            return;
        }
        if let Err(e) = channel.request_shell(true).await {
            let _ = app_handle.emit("pty:error", (sid.clone(), e.to_string()));
            registry_cleanup(&app_handle, &sid);
            return;
        }

        loop {
            tokio::select! {
                input = input_rx.recv() => {
                    match input {
                        Some(PtyInput::Data(bytes)) => {
                            let _ = channel.data(&bytes[..]).await;
                        }
                        Some(PtyInput::Resize { cols, rows }) => {
                            let _ = channel.window_change(cols, rows, 0, 0).await;
                        }
                        Some(PtyInput::Close) | None => {
                            let _ = channel.eof().await;
                            break;
                        }
                    }
                }
                msg = channel.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { ref data }) => {
                            let _ = app_handle.emit(
                                "pty:data",
                                PtyDataPayload { session_id: &sid, data: String::from_utf8_lossy(data).to_string() },
                            );
                        }
                        Some(ChannelMsg::ExitStatus { .. }) | None => {
                            let _ = app_handle.emit("pty:closed", PtyEventPayload { session_id: &sid });
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }

        // Only this channel closes — the pooled connection stays open for
        // other features (Files/Monitor/quick commands) on the same device.
        registry_cleanup(&app_handle, &sid);
    });

    Ok(session_id)
}

fn registry_cleanup(app_handle: &AppHandle, session_id: &str) {
    if let Some(registry) = app_handle.try_state::<PtyRegistry>() {
        registry.0.lock().unwrap().remove(session_id);
    }
}

#[tauri::command]
pub fn ssh_pty_write(
    registry: State<'_, PtyRegistry>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let reg = registry.0.lock().unwrap();
    if let Some(handle) = reg.get(&session_id) {
        handle
            .input_tx
            .send(PtyInput::Data(data.into_bytes()))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn ssh_pty_resize(
    registry: State<'_, PtyRegistry>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    let reg = registry.0.lock().unwrap();
    if let Some(handle) = reg.get(&session_id) {
        handle
            .input_tx
            .send(PtyInput::Resize { cols, rows })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn ssh_pty_close(registry: State<'_, PtyRegistry>, session_id: String) -> Result<(), String> {
    let mut reg = registry.0.lock().unwrap();
    if let Some(handle) = reg.remove(&session_id) {
        let _ = handle.input_tx.send(PtyInput::Close);
    }
    Ok(())
}
