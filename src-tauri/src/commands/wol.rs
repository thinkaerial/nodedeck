use crate::core::wol;

#[tauri::command]
pub fn wol_send(mac_address: String) -> Result<(), String> {
    wol::send_magic_packet(&mac_address).map_err(|e| e.to_string())
}
