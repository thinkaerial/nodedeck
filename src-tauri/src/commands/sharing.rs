use tauri::State;

use crate::core::discovery;
use crate::core::sharing::{self, ShareRecord, ShareRegistry};

pub const SHARE_SERVER_PORT: u16 = 47821;

#[tauri::command]
pub async fn share_create(
    registry: State<'_, ShareRegistry>,
    source_path: String,
    password: Option<String>,
    expires_in_secs: Option<u64>,
    download_limit: Option<u32>,
) -> Result<ShareRecord, String> {
    sharing::create_share(&registry, source_path, password, expires_in_secs, download_limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn share_list(registry: State<'_, ShareRegistry>) -> Result<Vec<ShareRecord>, String> {
    Ok(sharing::list_shares(&registry).await)
}

#[tauri::command]
pub async fn share_revoke(registry: State<'_, ShareRegistry>, id: String) -> Result<(), String> {
    sharing::revoke_share(&registry, &id).await.map_err(|e| e.to_string())
}

/// Best-effort LAN URL base (http://<local-ip>:<port>) for constructing share links.
/// This is LAN-reachable only — recipients outside the local network need a
/// tunnel/relay, which is not implemented (see SUGGESTIONS.md / spec section 7).
#[tauri::command]
pub fn share_lan_base_url() -> Option<String> {
    discovery::local_ipv4().map(|ip| format!("http://{ip}:{}", SHARE_SERVER_PORT))
}
