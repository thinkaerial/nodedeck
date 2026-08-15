use crate::core::nettools::{self, CommandOutput};

#[tauri::command]
pub async fn net_ping(target: String) -> Result<CommandOutput, String> {
    nettools::ping(&target).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn net_dns_lookup(target: String) -> Result<CommandOutput, String> {
    nettools::dns_lookup(&target).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn net_arp_table() -> Result<CommandOutput, String> {
    nettools::arp_table().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn net_port_check(target: String, port: u16) -> Result<CommandOutput, String> {
    nettools::port_check(&target, port).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn net_traceroute(target: String) -> Result<CommandOutput, String> {
    nettools::traceroute(&target).await.map_err(|e| e.to_string())
}
