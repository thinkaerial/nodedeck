use crate::core::vault;

#[tauri::command]
pub fn vault_set_password(device_id: String, password: String) -> Result<(), String> {
    vault::set_password(&device_id, &password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_get_password(device_id: String) -> Result<Option<String>, String> {
    vault::get_password(&device_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_delete_password(device_id: String) -> Result<(), String> {
    vault::delete_password(&device_id).map_err(|e| e.to_string())
}
