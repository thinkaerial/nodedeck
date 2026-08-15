use std::path::PathBuf;

use anyhow::Result;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

/// Embedded SQLite (rusqlite "bundled" feature — the SQLite C source is
/// compiled directly into this binary, no system SQLite install required).
/// One file, `nodedeck.db`, in the same app-data directory as everything
/// else (`core::auth`, `core::known_hosts`). Every table below carries an
/// `owner` column (the logged-in username) so each account has a fully
/// separate setup — devices, groups, tasks, audit log — not a shared pool.
fn db_path() -> Result<PathBuf> {
    let dir = if let Ok(override_dir) = std::env::var("NODEDECK_CONFIG_DIR") {
        PathBuf::from(override_dir)
    } else {
        dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("no config directory available on this platform"))?
            .join("nodedeck")
    };
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("nodedeck.db"))
}

fn connect() -> Result<Connection> {
    let conn = Connection::open(db_path()?)?;

    // Phase 1: create tables if they don't exist yet — no indexes on `owner`
    // here, since a pre-existing table from before multi-user support won't
    // have that column yet and an index on a missing column fails outright.
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            owner TEXT NOT NULL DEFAULT '',
            alias TEXT NOT NULL,
            device_type TEXT NOT NULL,
            ip TEXT NOT NULL,
            hostname TEXT NOT NULL,
            mac_vendor TEXT,
            group_id TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            ssh_port INTEGER NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL DEFAULT '',
            private_key_path TEXT,
            private_key_passphrase TEXT,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            owner TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL,
            task_type TEXT NOT NULL,
            config_json TEXT NOT NULL DEFAULT '{}',
            destructive INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_runs (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            device_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            retry_count INTEGER NOT NULL DEFAULT 0,
            result_summary TEXT,
            started_at INTEGER,
            finished_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id);

        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            owner TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT NOT NULL DEFAULT '',
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            target TEXT,
            at INTEGER NOT NULL
        );
        "#,
    )?;

    // Phase 2: add `owner` to any table that predates it, and hand
    // pre-existing rows to the sole account if there's exactly one.
    migrate_add_owner_columns(&conn)?;

    // Phase 3: now that every table definitely has `owner`, index it.
    conn.execute_batch(
        r#"
        CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner);
        CREATE INDEX IF NOT EXISTS idx_devices_group ON devices(group_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner);
        CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner);
        CREATE INDEX IF NOT EXISTS idx_audit_log_owner ON audit_log(owner);
        "#,
    )?;

    Ok(conn)
}

/// `CREATE TABLE IF NOT EXISTS` only creates a table the first time — it does
/// NOT add new columns to a table that already existed from before this
/// column was introduced (this app shipped devices/tasks/groups/audit_log
/// without `owner` before multi-user support). Without this, every owner-
/// scoped query fails with "no such column: owner" against a pre-existing
/// database file. Runs once per connection; cheap (PRAGMA + at most 4 ALTERs).
fn migrate_add_owner_columns(conn: &Connection) -> Result<()> {
    let mut any_column_added = false;
    for table in ["devices", "tasks", "groups", "audit_log"] {
        let has_owner_column: bool = conn
            .prepare(&format!("PRAGMA table_info({table})"))?
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .any(|name| name == "owner");
        if !has_owner_column {
            conn.execute(&format!("ALTER TABLE {table} ADD COLUMN owner TEXT NOT NULL DEFAULT ''"), [])?;
            any_column_added = true;
        }
    }

    // Rows that predate multi-user support land with owner='' after the ALTER
    // above and would otherwise vanish (no account is ever logged in as "").
    // If there's exactly one account, it's unambiguous who those rows
    // belonged to — hand them over rather than orphaning them.
    if any_column_added {
        let usernames = super::auth::list_usernames();
        if let [only_user] = usernames.as_slice() {
            for table in ["devices", "tasks", "groups", "audit_log"] {
                conn.execute(
                    &format!("UPDATE {table} SET owner = ?1 WHERE owner = ''"),
                    [only_user],
                )?;
            }
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbDevice {
    pub id: String,
    pub alias: String,
    pub device_type: String,
    pub ip: String,
    pub hostname: String,
    pub mac_vendor: Option<String>,
    pub group_id: Option<String>,
    pub tags: Vec<String>,
    pub ssh_port: u16,
    pub username: String,
    pub password: String,
    pub private_key_path: Option<String>,
    pub private_key_passphrase: Option<String>,
}

fn device_from_row(row: &rusqlite::Row) -> rusqlite::Result<DbDevice> {
    let tags_json: String = row.get(7)?;
    Ok(DbDevice {
        id: row.get(0)?,
        alias: row.get(1)?,
        device_type: row.get(2)?,
        ip: row.get(3)?,
        hostname: row.get(4)?,
        mac_vendor: row.get(5)?,
        group_id: row.get(6)?,
        tags: serde_json::from_str(&tags_json).unwrap_or_default(),
        ssh_port: row.get(8)?,
        username: row.get(9)?,
        password: row.get(10)?,
        private_key_path: row.get(11)?,
        private_key_passphrase: row.get(12)?,
    })
}

const DEVICE_COLUMNS: &str = "id, alias, device_type, ip, hostname, mac_vendor, group_id, tags, ssh_port, username, password, private_key_path, private_key_passphrase";

pub fn list_devices(owner: &str) -> Result<Vec<DbDevice>> {
    let conn = connect()?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {DEVICE_COLUMNS} FROM devices WHERE owner = ?1 ORDER BY created_at"
    ))?;
    let rows = stmt.query_map([owner], device_from_row)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn upsert_device(owner: &str, device: &DbDevice) -> Result<()> {
    let conn = connect()?;
    let tags_json = serde_json::to_string(&device.tags)?;
    conn.execute(
        r#"
        INSERT INTO devices (id, owner, alias, device_type, ip, hostname, mac_vendor, group_id, tags, ssh_port, username, password, private_key_path, private_key_passphrase, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, strftime('%s','now'))
        ON CONFLICT(id) DO UPDATE SET
            alias = excluded.alias,
            device_type = excluded.device_type,
            ip = excluded.ip,
            hostname = excluded.hostname,
            mac_vendor = excluded.mac_vendor,
            group_id = excluded.group_id,
            tags = excluded.tags,
            ssh_port = excluded.ssh_port,
            username = excluded.username,
            password = excluded.password,
            private_key_path = excluded.private_key_path,
            private_key_passphrase = excluded.private_key_passphrase
        WHERE devices.owner = ?2
        "#,
        rusqlite::params![
            device.id,
            owner,
            device.alias,
            device.device_type,
            device.ip,
            device.hostname,
            device.mac_vendor,
            device.group_id,
            tags_json,
            device.ssh_port,
            device.username,
            device.password,
            device.private_key_path,
            device.private_key_passphrase,
        ],
    )?;
    Ok(())
}

pub fn delete_device(owner: &str, id: &str) -> Result<()> {
    let conn = connect()?;
    conn.execute("DELETE FROM devices WHERE id = ?1 AND owner = ?2", rusqlite::params![id, owner])?;
    Ok(())
}

pub fn get_device(owner: &str, id: &str) -> Result<Option<DbDevice>> {
    let conn = connect()?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {DEVICE_COLUMNS} FROM devices WHERE id = ?1 AND owner = ?2"
    ))?;
    let mut rows = stmt.query_map(rusqlite::params![id, owner], device_from_row)?;
    Ok(rows.next().transpose()?)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbTask {
    pub id: String,
    pub name: String,
    pub task_type: String,
    pub config_json: String,
    pub destructive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbTaskRun {
    pub id: String,
    pub task_id: String,
    pub device_id: String,
    pub status: String,
    pub retry_count: u32,
    pub result_summary: Option<String>,
}

pub fn create_task(owner: &str, task: &DbTask, target_device_ids: &[String]) -> Result<Vec<DbTaskRun>> {
    let mut conn = connect()?;
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO tasks (id, owner, name, task_type, config_json, destructive, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%s','now'))",
        rusqlite::params![task.id, owner, task.name, task.task_type, task.config_json, task.destructive],
    )?;

    let mut runs = Vec::new();
    for device_id in target_device_ids {
        let run_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO task_runs (id, task_id, device_id, status) VALUES (?1, ?2, ?3, 'queued')",
            rusqlite::params![run_id, task.id, device_id],
        )?;
        runs.push(DbTaskRun {
            id: run_id,
            task_id: task.id.clone(),
            device_id: device_id.clone(),
            status: "queued".to_string(),
            retry_count: 0,
            result_summary: None,
        });
    }
    tx.commit()?;
    Ok(runs)
}

pub fn list_tasks(owner: &str) -> Result<Vec<DbTask>> {
    let conn = connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, name, task_type, config_json, destructive FROM tasks WHERE owner = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([owner], |row| {
        Ok(DbTask {
            id: row.get(0)?,
            name: row.get(1)?,
            task_type: row.get(2)?,
            config_json: row.get(3)?,
            destructive: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn list_task_runs(task_id: &str) -> Result<Vec<DbTaskRun>> {
    let conn = connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, task_id, device_id, status, retry_count, result_summary FROM task_runs WHERE task_id = ?1",
    )?;
    let rows = stmt.query_map([task_id], |row| {
        Ok(DbTaskRun {
            id: row.get(0)?,
            task_id: row.get(1)?,
            device_id: row.get(2)?,
            status: row.get(3)?,
            retry_count: row.get(4)?,
            result_summary: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn update_task_run_status(run_id: &str, status: &str, result_summary: Option<&str>) -> Result<()> {
    let conn = connect()?;
    conn.execute(
        "UPDATE task_runs SET status = ?1, result_summary = ?2, finished_at = CASE WHEN ?1 IN ('success','failed','skipped') THEN strftime('%s','now') ELSE finished_at END, started_at = CASE WHEN ?1 = 'running' THEN strftime('%s','now') ELSE started_at END WHERE id = ?3",
        rusqlite::params![status, result_summary, run_id],
    )?;
    Ok(())
}

pub fn increment_retry_and_requeue(run_id: &str) -> Result<()> {
    let conn = connect()?;
    conn.execute(
        "UPDATE task_runs SET status = 'queued', retry_count = retry_count + 1 WHERE id = ?1",
        [run_id],
    )?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbGroup {
    pub id: String,
    pub name: String,
}

pub fn list_groups(owner: &str) -> Result<Vec<DbGroup>> {
    let conn = connect()?;
    let mut stmt = conn.prepare("SELECT id, name FROM groups WHERE owner = ?1 ORDER BY created_at")?;
    let rows = stmt.query_map([owner], |row| Ok(DbGroup { id: row.get(0)?, name: row.get(1)? }))?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn create_group(owner: &str, name: &str) -> Result<DbGroup> {
    let conn = connect()?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO groups (id, owner, name, created_at) VALUES (?1, ?2, ?3, strftime('%s','now'))",
        rusqlite::params![id, owner, name],
    )?;
    Ok(DbGroup { id, name: name.to_string() })
}

pub fn delete_group(owner: &str, id: &str) -> Result<()> {
    let conn = connect()?;
    conn.execute(
        "UPDATE devices SET group_id = NULL WHERE group_id = ?1 AND owner = ?2",
        rusqlite::params![id, owner],
    )?;
    conn.execute("DELETE FROM groups WHERE id = ?1 AND owner = ?2", rusqlite::params![id, owner])?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbAuditEntry {
    pub id: i64,
    pub actor: String,
    pub action: String,
    pub target: Option<String>,
    pub at: i64,
}

/// Records a sensitive operation (spec section 3.9/8: "Audit log for
/// sensitive operations"), scoped to the account that performed it.
/// Best-effort — a failure to write an audit entry never blocks the
/// operation it's recording.
pub fn log_audit(owner: &str, actor: &str, action: &str, target: Option<&str>) {
    let result = (|| -> Result<()> {
        let conn = connect()?;
        conn.execute(
            "INSERT INTO audit_log (owner, actor, action, target, at) VALUES (?1, ?2, ?3, ?4, strftime('%s','now'))",
            rusqlite::params![owner, actor, action, target],
        )?;
        Ok(())
    })();
    if let Err(e) = result {
        log::warn!("failed to write audit log entry: {e}");
    }
}

pub fn list_audit_log(owner: &str, limit: u32) -> Result<Vec<DbAuditEntry>> {
    let conn = connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, actor, action, target, at FROM audit_log WHERE owner = ?1 ORDER BY at DESC LIMIT ?2",
    )?;
    let rows = stmt.query_map(rusqlite::params![owner, limit], |row| {
        Ok(DbAuditEntry {
            id: row.get(0)?,
            actor: row.get(1)?,
            action: row.get(2)?,
            target: row.get(3)?,
            at: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    fn with_temp_config_dir<F: FnOnce()>(f: F) {
        let tmp = std::env::temp_dir().join(format!("nodedeck_db_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&tmp).unwrap();
        std::env::set_var("NODEDECK_CONFIG_DIR", &tmp);
        f();
        std::env::remove_var("NODEDECK_CONFIG_DIR");
        std::fs::remove_dir_all(&tmp).ok();
    }

    fn sample(id: &str) -> DbDevice {
        DbDevice {
            id: id.to_string(),
            alias: "drone-01".to_string(),
            device_type: "raspberry_pi".to_string(),
            ip: "10.0.0.5".to_string(),
            hostname: "drone-01.local".to_string(),
            mac_vendor: Some("Raspberry Pi Foundation".to_string()),
            group_id: None,
            tags: vec!["field".to_string(), "pixhawk".to_string()],
            ssh_port: 22,
            username: "pi".to_string(),
            password: "secret".to_string(),
            private_key_path: None,
            private_key_passphrase: None,
        }
    }

    #[test]
    #[serial]
    fn insert_list_and_delete_roundtrip() {
        with_temp_config_dir(|| {
            assert_eq!(list_devices("alice").unwrap().len(), 0);

            upsert_device("alice", &sample("dev-1")).unwrap();
            let devices = list_devices("alice").unwrap();
            assert_eq!(devices.len(), 1);
            assert_eq!(devices[0].alias, "drone-01");
            assert_eq!(devices[0].tags, vec!["field", "pixhawk"]);

            delete_device("alice", "dev-1").unwrap();
            assert_eq!(list_devices("alice").unwrap().len(), 0);
        });
    }

    #[test]
    #[serial]
    fn upsert_updates_existing_row_not_duplicates() {
        with_temp_config_dir(|| {
            upsert_device("alice", &sample("dev-1")).unwrap();
            let mut updated = sample("dev-1");
            updated.alias = "renamed".to_string();
            upsert_device("alice", &updated).unwrap();

            let devices = list_devices("alice").unwrap();
            assert_eq!(devices.len(), 1);
            assert_eq!(devices[0].alias, "renamed");
        });
    }

    #[test]
    #[serial]
    fn devices_are_isolated_per_owner() {
        with_temp_config_dir(|| {
            upsert_device("alice", &sample("dev-1")).unwrap();
            upsert_device("bob", &sample("dev-2")).unwrap();

            assert_eq!(list_devices("alice").unwrap().len(), 1);
            assert_eq!(list_devices("bob").unwrap().len(), 1);
            assert_eq!(list_devices("alice").unwrap()[0].id, "dev-1");

            // Bob can't see or delete Alice's device by id.
            assert!(get_device("bob", "dev-1").unwrap().is_none());
            delete_device("bob", "dev-1").unwrap();
            assert_eq!(list_devices("alice").unwrap().len(), 1, "Bob's delete must not remove Alice's device");
        });
    }

    #[test]
    #[serial]
    fn create_list_and_delete_group_clears_device_group_id() {
        with_temp_config_dir(|| {
            let group = create_group("alice", "Drone fleet").unwrap();
            assert_eq!(list_groups("alice").unwrap().len(), 1);

            let mut device = sample("dev-1");
            device.group_id = Some(group.id.clone());
            upsert_device("alice", &device).unwrap();

            delete_group("alice", &group.id).unwrap();
            assert_eq!(list_groups("alice").unwrap().len(), 0);
            assert_eq!(list_devices("alice").unwrap()[0].group_id, None);
        });
    }

    #[test]
    #[serial]
    fn audit_log_is_isolated_per_owner() {
        with_temp_config_dir(|| {
            log_audit("alice", "alice", "device_added", Some("drone-01"));
            log_audit("bob", "bob", "share_created", Some("flight_log.bin"));

            let alice_entries = list_audit_log("alice", 10).unwrap();
            assert_eq!(alice_entries.len(), 1);
            assert_eq!(alice_entries[0].action, "device_added");

            let bob_entries = list_audit_log("bob", 10).unwrap();
            assert_eq!(bob_entries.len(), 1);
            assert_eq!(bob_entries[0].action, "share_created");
        });
    }

    #[test]
    #[serial]
    fn migrates_pre_owner_column_database_to_the_sole_account() {
        with_temp_config_dir(|| {
            // Simulate a database created before multi-user support: a
            // devices table with no `owner` column at all, holding one row.
            {
                let conn = Connection::open(db_path().unwrap()).unwrap();
                conn.execute_batch(
                    "CREATE TABLE devices (
                        id TEXT PRIMARY KEY, alias TEXT NOT NULL, device_type TEXT NOT NULL,
                        ip TEXT NOT NULL, hostname TEXT NOT NULL, mac_vendor TEXT, group_id TEXT,
                        tags TEXT NOT NULL DEFAULT '[]', ssh_port INTEGER NOT NULL,
                        username TEXT NOT NULL, password TEXT NOT NULL DEFAULT '',
                        private_key_path TEXT, private_key_passphrase TEXT, created_at INTEGER NOT NULL
                    );
                    INSERT INTO devices (id, alias, device_type, ip, hostname, ssh_port, username, created_at)
                    VALUES ('legacy-1', 'my-pi', 'raspberry_pi', '10.0.0.9', 'my-pi.local', 22, 'pi', 1000);",
                )
                .unwrap();
            }

            // Exactly one account exists — the unambiguous case this backfill targets.
            super::super::auth::create_account("cyberhack", "password123").unwrap();

            let devices = list_devices("cyberhack").unwrap();
            assert_eq!(devices.len(), 1, "legacy row should be handed to the sole account, not orphaned");
            assert_eq!(devices[0].alias, "my-pi");
        });
    }
}
