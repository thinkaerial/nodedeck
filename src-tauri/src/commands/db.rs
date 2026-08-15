use tauri::State;

use crate::core::db::{self, DbAuditEntry, DbDevice, DbGroup};
use crate::state::AppSession;

#[tauri::command]
pub fn db_list_devices(session: State<'_, AppSession>) -> Result<Vec<DbDevice>, String> {
    let owner = session.current_user()?;
    db::list_devices(&owner).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_device(session: State<'_, AppSession>, device: DbDevice) -> Result<(), String> {
    let owner = session.current_user()?;
    let is_new = matches!(db::get_device(&owner, &device.id), Ok(None));
    db::upsert_device(&owner, &device).map_err(|e| e.to_string())?;
    db::log_audit(
        &owner,
        &owner,
        if is_new { "device_added" } else { "device_updated" },
        Some(&device.alias),
    );
    Ok(())
}

#[tauri::command]
pub fn db_delete_device(session: State<'_, AppSession>, id: String) -> Result<(), String> {
    let owner = session.current_user()?;
    let alias = db::get_device(&owner, &id).ok().flatten().map(|d| d.alias);
    db::delete_device(&owner, &id).map_err(|e| e.to_string())?;
    db::log_audit(&owner, &owner, "device_removed", alias.as_deref());
    Ok(())
}

/// Bulk import — reads a JSON file containing an array of devices in the
/// same shape as a single `db_save_device` call, upserts each one into the
/// current account's device list. Spec section 3.2 calls for "import/export
/// device definitions in an open, documented format" — plain JSON matching
/// our own DbDevice shape is that format; no bespoke schema.
#[tauri::command]
pub fn db_import_devices(session: State<'_, AppSession>, file_path: String) -> Result<u32, String> {
    let owner = session.current_user()?;
    let contents = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let devices: Vec<DbDevice> = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    let count = devices.len() as u32;
    for device in &devices {
        db::upsert_device(&owner, device).map_err(|e| e.to_string())?;
    }
    db::log_audit(&owner, &owner, "devices_imported", Some(&format!("{count} device(s) from {file_path}")));
    Ok(count)
}

#[tauri::command]
pub fn db_export_devices(session: State<'_, AppSession>, file_path: String) -> Result<(), String> {
    let owner = session.current_user()?;
    let devices = db::list_devices(&owner).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&devices).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, json).map_err(|e| e.to_string())?;
    db::log_audit(&owner, &owner, "devices_exported", Some(&file_path));
    Ok(())
}

#[tauri::command]
pub fn db_list_groups(session: State<'_, AppSession>) -> Result<Vec<DbGroup>, String> {
    let owner = session.current_user()?;
    db::list_groups(&owner).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_create_group(session: State<'_, AppSession>, name: String) -> Result<DbGroup, String> {
    let owner = session.current_user()?;
    let group = db::create_group(&owner, &name).map_err(|e| e.to_string())?;
    db::log_audit(&owner, &owner, "group_created", Some(&name));
    Ok(group)
}

#[tauri::command]
pub fn db_delete_group(session: State<'_, AppSession>, id: String) -> Result<(), String> {
    let owner = session.current_user()?;
    db::delete_group(&owner, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_list_audit_log(session: State<'_, AppSession>) -> Result<Vec<DbAuditEntry>, String> {
    let owner = session.current_user()?;
    db::list_audit_log(&owner, 100).map_err(|e| e.to_string())
}
