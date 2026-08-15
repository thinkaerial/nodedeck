use anyhow::Result;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct LocalEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

pub fn home_dir() -> Option<String> {
    dirs::home_dir().map(|p| p.to_string_lossy().to_string())
}

/// Read-only local directory listing. No write/create/delete function exists
/// in this module — matches the read-only-for-now stance of core::sftp.
pub fn list_dir(path: &str) -> Result<Vec<LocalEntry>> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        entries.push(LocalEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: if metadata.is_dir() { None } else { Some(metadata.len()) },
        });
    }
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(entries)
}
