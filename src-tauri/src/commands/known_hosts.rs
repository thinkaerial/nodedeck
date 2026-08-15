use crate::core::known_hosts;

#[tauri::command]
pub fn known_hosts_get(host: String, port: u16) -> Option<String> {
    known_hosts::get(&host, port)
}

/// Used when a host-key mismatch is confirmed by the user to be expected
/// (device reimaged, SSH host key regenerated) rather than an attack.
#[tauri::command]
pub fn known_hosts_forget(host: String, port: u16) -> Result<(), String> {
    known_hosts::forget(&host, port).map_err(|e| e.to_string())
}
