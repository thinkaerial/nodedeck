use std::collections::HashMap;
use std::path::PathBuf;

use anyhow::Result;

fn store_path() -> Result<PathBuf> {
    // Same override pattern as core::auth, so tests never touch the real
    // user config directory.
    let dir = if let Ok(override_dir) = std::env::var("NODEDECK_CONFIG_DIR") {
        PathBuf::from(override_dir)
    } else {
        dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("no config directory available on this platform"))?
            .join("nodedeck")
    };
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("known_hosts.json"))
}

fn key_id(host: &str, port: u16) -> String {
    format!("{host}:{port}")
}

fn load() -> HashMap<String, String> {
    store_path()
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(map: &HashMap<String, String>) -> Result<()> {
    std::fs::write(store_path()?, serde_json::to_string_pretty(map)?)?;
    Ok(())
}

pub fn get(host: &str, port: u16) -> Option<String> {
    load().get(&key_id(host, port)).cloned()
}

pub fn trust(host: &str, port: u16, fingerprint: &str) -> Result<()> {
    let mut map = load();
    map.insert(key_id(host, port), fingerprint.to_string());
    save(&map)
}

/// Removes a stored fingerprint — used when a user explicitly confirms a host
/// key change was expected (e.g. the device was reimaged) and wants to trust
/// the new key.
pub fn forget(host: &str, port: u16) -> Result<()> {
    let mut map = load();
    map.remove(&key_id(host, port));
    save(&map)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    fn with_temp_config_dir<F: FnOnce()>(f: F) {
        let tmp = std::env::temp_dir().join(format!("nodedeck_kh_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("NODEDECK_CONFIG_DIR", &tmp);
        f();
        std::env::remove_var("NODEDECK_CONFIG_DIR");
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    #[serial]
    fn trust_get_and_forget_roundtrip() {
        with_temp_config_dir(|| {
            assert_eq!(get("10.0.0.1", 22), None);
            trust("10.0.0.1", 22, "SHA256:abc").unwrap();
            assert_eq!(get("10.0.0.1", 22), Some("SHA256:abc".to_string()));
            forget("10.0.0.1", 22).unwrap();
            assert_eq!(get("10.0.0.1", 22), None);
        });
    }

    #[test]
    #[serial]
    fn different_ports_are_independent() {
        with_temp_config_dir(|| {
            trust("10.0.0.1", 22, "SHA256:a").unwrap();
            trust("10.0.0.1", 2222, "SHA256:b").unwrap();
            assert_eq!(get("10.0.0.1", 22), Some("SHA256:a".to_string()));
            assert_eq!(get("10.0.0.1", 2222), Some("SHA256:b".to_string()));
        });
    }
}
