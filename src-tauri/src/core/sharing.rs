use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{bail, Result};
use serde::Serialize;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct ShareAccessEntry {
    pub at: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShareRecord {
    pub id: String,
    pub file_name: String,
    #[serde(skip)]
    pub source_path: PathBuf,
    pub token: String,
    #[serde(skip)]
    pub password: Option<String>,
    pub password_protected: bool,
    pub expires_at: Option<u64>,
    pub download_limit: Option<u32>,
    pub download_count: u32,
    pub revoked: bool,
    pub created_at: u64,
    pub access_log: Vec<ShareAccessEntry>,
}

pub type ShareRegistry = Arc<Mutex<HashMap<String, ShareRecord>>>;

pub fn new_registry() -> ShareRegistry {
    Arc::new(Mutex::new(HashMap::new()))
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

pub async fn create_share(
    registry: &ShareRegistry,
    source_path: String,
    password: Option<String>,
    expires_in_secs: Option<u64>,
    download_limit: Option<u32>,
) -> Result<ShareRecord> {
    let path = PathBuf::from(&source_path);
    let metadata = std::fs::metadata(&path)?;
    if !metadata.is_file() {
        bail!("not a file: {source_path}");
    }
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| source_path.clone());

    let record = ShareRecord {
        id: Uuid::new_v4().to_string(),
        file_name,
        source_path: path,
        token: Uuid::new_v4().simple().to_string(),
        password_protected: password.is_some(),
        password,
        expires_at: expires_in_secs.map(|s| now() + s),
        download_limit,
        download_count: 0,
        revoked: false,
        created_at: now(),
        access_log: Vec::new(),
    };

    registry.lock().await.insert(record.token.clone(), record.clone());
    Ok(record)
}

pub async fn list_shares(registry: &ShareRegistry) -> Vec<ShareRecord> {
    let mut list: Vec<ShareRecord> = registry.lock().await.values().cloned().collect();
    list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    list
}

pub async fn revoke_share(registry: &ShareRegistry, id: &str) -> Result<()> {
    let mut guard = registry.lock().await;
    let Some(record) = guard.values_mut().find(|r| r.id == id) else {
        bail!("share not found");
    };
    record.revoked = true;
    Ok(())
}
