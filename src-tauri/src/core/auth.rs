use std::collections::HashMap;
use std::path::PathBuf;

use anyhow::{bail, Result};
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;

/// Multiple local accounts can exist — spec section 3.9 anticipates a role
/// model for future team deployments, and separately, more than one person
/// may share this machine. Stored as username -> Argon2id hash; the
/// plaintext password is never written to disk. This is the app's own
/// login, separate from any device SSH credential.
fn accounts_path() -> Result<PathBuf> {
    // Test override — `dirs::config_dir()` ignores XDG_CONFIG_HOME on macOS, so tests
    // use this explicit override to avoid touching the real user config directory.
    let dir = if let Ok(override_dir) = std::env::var("NODEDECK_CONFIG_DIR") {
        PathBuf::from(override_dir)
    } else {
        dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("no config directory available on this platform"))?
            .join("nodedeck")
    };
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("accounts.json"))
}

#[derive(serde::Deserialize)]
struct LegacySingleAccount {
    username: String,
    password_hash: String,
}

/// One-time migration from the original single-account `account.json` (from
/// before multi-user support existed) into the new `accounts.json` map.
fn migrate_legacy_account_file() -> Option<HashMap<String, String>> {
    let dir = accounts_path().ok()?.parent()?.to_path_buf();
    let legacy_path = dir.join("account.json");
    let contents = std::fs::read_to_string(&legacy_path).ok()?;
    let legacy: LegacySingleAccount = serde_json::from_str(&contents).ok()?;
    let mut accounts = HashMap::new();
    accounts.insert(legacy.username, legacy.password_hash);
    let _ = save_accounts(&accounts);
    let _ = std::fs::remove_file(&legacy_path);
    Some(accounts)
}

fn load_accounts() -> HashMap<String, String> {
    let path = match accounts_path() {
        Ok(p) => p,
        Err(_) => return HashMap::new(),
    };
    if !path.exists() {
        if let Some(migrated) = migrate_legacy_account_file() {
            return migrated;
        }
    }
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_accounts(accounts: &HashMap<String, String>) -> Result<()> {
    std::fs::write(accounts_path()?, serde_json::to_string_pretty(accounts)?)?;
    Ok(())
}

pub fn account_exists() -> bool {
    !load_accounts().is_empty()
}

pub fn list_usernames() -> Vec<String> {
    let mut names: Vec<String> = load_accounts().into_keys().collect();
    names.sort();
    names
}

pub fn create_account(username: &str, password: &str) -> Result<()> {
    let username = username.trim();
    if username.is_empty() {
        bail!("username cannot be empty");
    }
    if password.len() < 8 {
        bail!("password must be at least 8 characters");
    }

    let mut accounts = load_accounts();
    if accounts.contains_key(username) {
        bail!("an account named \"{username}\" already exists");
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .to_string();

    accounts.insert(username.to_string(), hash);
    save_accounts(&accounts)
}

pub fn verify_password(username: &str, password: &str) -> Result<bool> {
    let accounts = load_accounts();
    let Some(stored_hash) = accounts.get(username.trim()) else {
        bail!("no account named \"{username}\"");
    };
    let parsed_hash = PasswordHash::new(stored_hash).map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    fn with_temp_config_dir<F: FnOnce()>(f: F) {
        let tmp = std::env::temp_dir().join(format!("nodedeck_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("NODEDECK_CONFIG_DIR", &tmp);
        f();
        std::env::remove_var("NODEDECK_CONFIG_DIR");
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    #[serial]
    fn create_verify_and_reject_wrong_password() {
        with_temp_config_dir(|| {
            assert!(!account_exists());
            create_account("rohit", "correct horse battery staple").unwrap();
            assert!(account_exists());
            assert!(verify_password("rohit", "correct horse battery staple").unwrap());
            assert!(!verify_password("rohit", "wrong password").unwrap());
        });
    }

    #[test]
    #[serial]
    fn supports_multiple_independent_accounts() {
        with_temp_config_dir(|| {
            create_account("alice", "password123").unwrap();
            create_account("bob", "password456").unwrap();

            assert_eq!(list_usernames(), vec!["alice".to_string(), "bob".to_string()]);
            assert!(verify_password("alice", "password123").unwrap());
            assert!(verify_password("bob", "password456").unwrap());
            // Alice's password doesn't work for Bob's account.
            assert!(!verify_password("bob", "password123").unwrap());
        });
    }

    #[test]
    #[serial]
    fn rejects_duplicate_username() {
        with_temp_config_dir(|| {
            create_account("alice", "password123").unwrap();
            assert!(create_account("alice", "different_password").is_err());
        });
    }

    #[test]
    #[serial]
    fn rejects_short_password() {
        with_temp_config_dir(|| {
            assert!(create_account("a", "short").is_err());
            assert!(!account_exists());
        });
    }

    #[test]
    #[serial]
    fn verify_fails_for_unknown_username() {
        with_temp_config_dir(|| {
            create_account("alice", "password123").unwrap();
            assert!(verify_password("nobody", "password123").is_err());
        });
    }

    #[test]
    #[serial]
    fn migrates_legacy_single_account_file() {
        with_temp_config_dir(|| {
            // Simulate a pre-multi-user install: create an account the old
            // way, hash included, written directly to the old filename.
            let salt = SaltString::generate(&mut OsRng);
            let hash = Argon2::default().hash_password(b"old-password", &salt).unwrap().to_string();
            let legacy = format!(r#"{{"username":"rohit","password_hash":{}}}"#, serde_json::to_string(&hash).unwrap());
            let dir = accounts_path().unwrap().parent().unwrap().to_path_buf();
            std::fs::write(dir.join("account.json"), legacy).unwrap();

            assert!(account_exists());
            assert!(verify_password("rohit", "old-password").unwrap());
            assert_eq!(list_usernames(), vec!["rohit".to_string()]);
            assert!(!dir.join("account.json").exists(), "legacy file should be removed after migration");
        });
    }
}
