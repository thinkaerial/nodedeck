use tauri::State;

use crate::core::{auth, biometric};
use crate::state::AppSession;

#[tauri::command]
pub fn auth_account_exists() -> bool {
    auth::account_exists()
}

#[tauri::command]
pub fn auth_list_usernames() -> Vec<String> {
    auth::list_usernames()
}

#[tauri::command]
pub fn auth_create_account(
    session: State<'_, AppSession>,
    username: String,
    password: String,
) -> Result<(), String> {
    auth::create_account(&username, &password).map_err(|e| e.to_string())?;
    *session.0.lock().unwrap() = Some(username);
    Ok(())
}

#[tauri::command]
pub fn auth_verify_password(
    session: State<'_, AppSession>,
    username: String,
    password: String,
) -> Result<bool, String> {
    let ok = auth::verify_password(&username, &password).map_err(|e| e.to_string())?;
    if ok {
        *session.0.lock().unwrap() = Some(username);
    }
    Ok(ok)
}

#[tauri::command]
pub fn auth_current_user(session: State<'_, AppSession>) -> Option<String> {
    session.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn auth_logout(session: State<'_, AppSession>) {
    *session.0.lock().unwrap() = None;
}

#[tauri::command]
pub fn auth_biometric_available() -> bool {
    biometric::is_available()
}

/// Touch ID stands in for "you are this Mac's owner" rather than
/// differentiating between accounts biometrically — the frontend picks
/// which saved username to unlock as, Touch ID replaces typing that
/// username's password.
#[tauri::command]
pub async fn auth_biometric_unlock(
    session: State<'_, AppSession>,
    username: String,
    reason: String,
) -> Result<bool, String> {
    let ok = biometric::authenticate(reason).await.map_err(|e| e.to_string())?;
    if ok && auth::list_usernames().contains(&username) {
        *session.0.lock().unwrap() = Some(username);
        Ok(true)
    } else {
        Ok(false)
    }
}
