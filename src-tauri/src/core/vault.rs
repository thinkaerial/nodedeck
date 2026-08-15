use anyhow::{Context, Result};
use keyring::Entry;

/// Device SSH passwords go here — macOS Keychain / Windows Credential Manager
/// — instead of local storage. Only the password is vault-backed; host/port/
/// username are structural data, not secrets, and stay in the frontend's
/// persisted device list.
const SERVICE: &str = "com.thinkaerial.nodedeck";

fn entry(device_id: &str) -> Result<Entry> {
    Entry::new(SERVICE, device_id).context("failed to open keychain entry")
}

pub fn set_password(device_id: &str, password: &str) -> Result<()> {
    entry(device_id)?.set_password(password).context("failed to save password to keychain")
}

pub fn get_password(device_id: &str) -> Result<Option<String>> {
    match entry(device_id)?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e).context("failed to read password from keychain"),
    }
}

pub fn delete_password(device_id: &str) -> Result<()> {
    match entry(device_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e).context("failed to delete password from keychain"),
    }
}
