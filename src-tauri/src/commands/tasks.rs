use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::core::db::{self, DbTask, DbTaskRun};
use crate::core::ssh::ConnectionParams;
use crate::core::ssh_pool::SshPool;
use crate::core::tasks;
use crate::state::AppSession;

#[derive(Serialize)]
pub struct TaskWithRuns {
    pub task: DbTask,
    pub runs: Vec<DbTaskRun>,
}

#[tauri::command]
pub fn task_create(
    session: State<'_, AppSession>,
    name: String,
    task_type: String,
    config_json: String,
    target_device_ids: Vec<String>,
) -> Result<TaskWithRuns, String> {
    let owner = session.current_user()?;
    let task = DbTask {
        id: Uuid::new_v4().to_string(),
        name,
        task_type: task_type.clone(),
        config_json,
        destructive: tasks::is_destructive(&task_type),
    };
    let runs = db::create_task(&owner, &task, &target_device_ids).map_err(|e| e.to_string())?;
    db::log_audit(&owner, &owner, "task_created", Some(&task.name));
    Ok(TaskWithRuns { task, runs })
}

#[tauri::command]
pub fn task_list(session: State<'_, AppSession>) -> Result<Vec<TaskWithRuns>, String> {
    let owner = session.current_user()?;
    let tasks = db::list_tasks(&owner).map_err(|e| e.to_string())?;
    tasks
        .into_iter()
        .map(|task| {
            let runs = db::list_task_runs(&task.id).map_err(|e| e.to_string())?;
            Ok(TaskWithRuns { task, runs })
        })
        .collect()
}

#[derive(Clone, Serialize)]
struct TaskRunUpdatePayload<'a> {
    task_id: &'a str,
    run_id: &'a str,
    status: &'a str,
}

fn connection_params_for(device: &db::DbDevice) -> ConnectionParams {
    ConnectionParams {
        host: device.ip.clone(),
        port: device.ssh_port,
        username: device.username.clone(),
        password: device.password.clone(),
        private_key_path: device.private_key_path.clone(),
        private_key_passphrase: device.private_key_passphrase.clone(),
    }
}

async fn execute_run(app: &AppHandle, pool: &SshPool, owner: &str, task: &DbTask, run: &DbTaskRun) {
    let _ = db::update_task_run_status(&run.id, "running", None);
    let _ = app.emit(
        "task:update",
        TaskRunUpdatePayload { task_id: &task.id, run_id: &run.id, status: "running" },
    );

    let device = match db::get_device(owner, &run.device_id) {
        Ok(Some(d)) => d,
        Ok(None) => {
            let _ = db::update_task_run_status(&run.id, "failed", Some("device no longer exists"));
            let _ = app.emit(
                "task:update",
                TaskRunUpdatePayload { task_id: &task.id, run_id: &run.id, status: "failed" },
            );
            return;
        }
        Err(e) => {
            let _ = db::update_task_run_status(&run.id, "failed", Some(&e.to_string()));
            return;
        }
    };

    let kind = match tasks::parse_task_kind(&task.task_type, &task.config_json) {
        Ok(k) => k,
        Err(e) => {
            let _ = db::update_task_run_status(&run.id, "failed", Some(&format!("bad task config: {e}")));
            let _ = app.emit(
                "task:update",
                TaskRunUpdatePayload { task_id: &task.id, run_id: &run.id, status: "failed" },
            );
            return;
        }
    };

    let params = connection_params_for(&device);
    let (status, summary) = match tasks::run_one(pool, &params, &kind).await {
        Ok(summary) => ("success", summary),
        Err(e) => ("failed", e.to_string()),
    };

    let truncated: String = summary.chars().take(2000).collect();
    let _ = db::update_task_run_status(&run.id, status, Some(&truncated));
    let _ = app.emit("task:update", TaskRunUpdatePayload { task_id: &task.id, run_id: &run.id, status });
}

/// Runs every queued run for a task concurrently (bounded by however many
/// devices it targets — fleet tasks are typically a handful of devices, not
/// hundreds) and reports per-device progress via `task:update` events.
#[tauri::command]
pub async fn task_run(
    app: AppHandle,
    session: State<'_, AppSession>,
    pool: State<'_, SshPool>,
    task_id: String,
) -> Result<(), String> {
    let owner = session.current_user()?;
    let tasks_list = db::list_tasks(&owner).map_err(|e| e.to_string())?;
    let task = tasks_list
        .into_iter()
        .find(|t| t.id == task_id)
        .ok_or_else(|| "task not found".to_string())?;
    let runs = db::list_task_runs(&task_id).map_err(|e| e.to_string())?;
    let queued: Vec<_> = runs.into_iter().filter(|r| r.status == "queued").collect();

    let pool = pool.inner().clone();
    let futures = queued.iter().map(|run| execute_run(&app, &pool, &owner, &task, run));
    futures::future::join_all(futures).await;

    Ok(())
}

#[tauri::command]
pub fn task_retry_failed(task_id: String) -> Result<(), String> {
    let runs = db::list_task_runs(&task_id).map_err(|e| e.to_string())?;
    for run in runs.iter().filter(|r| r.status == "failed") {
        db::increment_retry_and_requeue(&run.id).map_err(|e| e.to_string())?;
    }
    Ok(())
}
