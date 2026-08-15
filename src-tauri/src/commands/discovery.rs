use crate::core::discovery::{self, DiscoveredDevice};

#[tauri::command]
pub fn discovery_default_cidr() -> Option<String> {
    let cidr = discovery::default_cidr();
    log::info!("discovery_default_cidr -> {cidr:?}");
    cidr
}

#[tauri::command]
pub async fn discovery_scan(cidr: String) -> Result<Vec<DiscoveredDevice>, String> {
    discovery::scan(&cidr).await.map_err(|e| e.to_string())
}
