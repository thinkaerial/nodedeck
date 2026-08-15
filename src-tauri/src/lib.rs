mod commands;
pub mod core;
mod state;

use core::sharing;
use core::ssh_pool::SshPool;
use state::{AppSession, PtyRegistry, SerialRegistry};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let share_registry = sharing::new_registry();

  tauri::Builder::default()
    .manage(PtyRegistry::default())
    .manage(SerialRegistry::default())
    .manage(SshPool::default())
    .manage(AppSession::default())
    .manage(share_registry.clone())
    .invoke_handler(tauri::generate_handler![
      commands::ssh::ssh_test_connection,
      commands::ssh::ssh_exec,
      commands::ssh::ssh_pty_open,
      commands::ssh::ssh_pty_write,
      commands::ssh::ssh_pty_resize,
      commands::ssh::ssh_pty_close,
      commands::monitor::monitor_snapshot,
      commands::sftp::sftp_list_dir,
      commands::nettools::net_ping,
      commands::nettools::net_dns_lookup,
      commands::nettools::net_arp_table,
      commands::nettools::net_port_check,
      commands::nettools::net_traceroute,
      commands::discovery::discovery_default_cidr,
      commands::discovery::discovery_scan,
      commands::localfs::local_home_dir,
      commands::localfs::local_list_dir,
      commands::sharing::share_create,
      commands::sharing::share_list,
      commands::sharing::share_revoke,
      commands::sharing::share_lan_base_url,
      commands::auth::auth_account_exists,
      commands::auth::auth_list_usernames,
      commands::auth::auth_create_account,
      commands::auth::auth_verify_password,
      commands::auth::auth_current_user,
      commands::auth::auth_logout,
      commands::auth::auth_biometric_available,
      commands::auth::auth_biometric_unlock,
      commands::known_hosts::known_hosts_get,
      commands::known_hosts::known_hosts_forget,
      commands::vault::vault_set_password,
      commands::vault::vault_get_password,
      commands::vault::vault_delete_password,
      commands::sftp::sftp_upload,
      commands::sftp::sftp_download,
      commands::serial::serial_list_ports,
      commands::serial::serial_open,
      commands::serial::serial_write,
      commands::serial::serial_close,
      commands::db::db_list_devices,
      commands::db::db_save_device,
      commands::db::db_delete_device,
      commands::db::db_import_devices,
      commands::db::db_export_devices,
      commands::db::db_list_groups,
      commands::db::db_create_group,
      commands::db::db_delete_group,
      commands::db::db_list_audit_log,
      commands::tasks::task_create,
      commands::tasks::task_list,
      commands::tasks::task_run,
      commands::tasks::task_retry_failed,
      commands::mdns::mdns_browse,
      commands::wol::wol_send,
    ])
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      tauri::async_runtime::spawn(core::share_server::run(
        share_registry.clone(),
        commands::sharing::SHARE_SERVER_PORT,
      ));

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
