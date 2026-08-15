use crate::core::localfs::{self, LocalEntry};

#[tauri::command]
pub fn local_home_dir() -> Option<String> {
    localfs::home_dir()
}

#[tauri::command]
pub fn local_list_dir(path: String) -> Result<Vec<LocalEntry>, String> {
    localfs::list_dir(&path).map_err(|e| e.to_string())
}
