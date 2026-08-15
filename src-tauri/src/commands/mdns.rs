use crate::core::mdns::{self, MdnsEntry};

#[tauri::command]
pub async fn mdns_browse() -> Result<Vec<MdnsEntry>, String> {
    mdns::browse(std::time::Duration::from_secs(4))
        .await
        .map_err(|e| e.to_string())
}
