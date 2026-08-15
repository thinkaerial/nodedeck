import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type TaskType =
  | "run_command"
  | "restart_service"
  | "check_disk"
  | "collect_diagnostics"
  | "download_logs"
  | "upload_file";

export type TaskRunStatus = "queued" | "running" | "success" | "failed" | "skipped";

export interface DbTask {
  id: string;
  name: string;
  task_type: TaskType;
  config_json: string;
  destructive: boolean;
}

export interface DbTaskRun {
  id: string;
  task_id: string;
  device_id: string;
  status: TaskRunStatus;
  retry_count: number;
  result_summary: string | null;
}

export interface TaskWithRuns {
  task: DbTask;
  runs: DbTaskRun[];
}

export const createTask = (
  name: string,
  taskType: TaskType,
  config: Record<string, unknown>,
  targetDeviceIds: string[],
): Promise<TaskWithRuns> =>
  invoke("task_create", { name, taskType, configJson: JSON.stringify(config), targetDeviceIds });

export const listTasks = (): Promise<TaskWithRuns[]> => invoke("task_list");
export const runTask = (taskId: string): Promise<void> => invoke("task_run", { taskId });
export const retryFailed = (taskId: string): Promise<void> => invoke("task_retry_failed", { taskId });

export function onTaskUpdate(
  cb: (taskId: string, runId: string, status: TaskRunStatus) => void,
): Promise<UnlistenFn> {
  return listen<{ task_id: string; run_id: string; status: TaskRunStatus }>("task:update", (event) => {
    cb(event.payload.task_id, event.payload.run_id, event.payload.status);
  });
}
