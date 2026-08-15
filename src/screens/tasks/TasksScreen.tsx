import { useEffect, useState } from "react";
import { Plus, RotateCcw, ListChecks, X, Loader2, Play } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { useRealDevicesStore } from "../../state/realDevices";
import * as tasksApi from "../../ipc/tasks";
import type { TaskType, TaskWithRuns, TaskRunStatus } from "../../ipc/tasks";

const STATUS_VARIANT: Record<TaskRunStatus, "neutral" | "accent" | "success" | "warning" | "error"> = {
  queued: "neutral",
  running: "accent",
  success: "success",
  failed: "error",
  skipped: "warning",
};

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  run_command: "Run command",
  restart_service: "Restart service",
  check_disk: "Check disk space",
  collect_diagnostics: "Collect diagnostics",
  download_logs: "Download logs",
  upload_file: "Upload file",
};

function NewTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const devices = useRealDevicesStore((s) => s.devices);
  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("collect_diagnostics");
  const [command, setCommand] = useState("");
  const [service, setService] = useState("");
  const [remotePath, setRemotePath] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const destructive = taskType === "restart_service" || taskType === "run_command";

  function toggleDevice(id: string) {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function config(): Record<string, unknown> {
    switch (taskType) {
      case "run_command":
        return { command };
      case "restart_service":
        return { service };
      case "download_logs":
        return { remote_path: remotePath, local_path: localPath };
      case "upload_file":
        return { local_path: localPath, remote_path: remotePath };
      default:
        return {};
    }
  }

  async function handleCreate() {
    setError("");
    setBusy(true);
    try {
      const { task } = await tasksApi.createTask(
        name || TASK_TYPE_LABEL[taskType],
        taskType,
        config(),
        Array.from(selectedDevices),
      );
      await tasksApi.runTask(task.id);
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = selectedDevices.size > 0 && (taskType !== "run_command" || command) && (taskType !== "restart_service" || service);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-bg-overlay p-4 shadow-[var(--shadow-2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text-primary">New fleet task</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder={TASK_TYPE_LABEL[taskType]} />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Task type</span>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)} className={inputCls}>
              {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>

          {taskType === "run_command" && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Command</span>
              <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="df -h" className={`${inputCls} font-mono`} />
            </label>
          )}
          {taskType === "restart_service" && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Service name</span>
              <input value={service} onChange={(e) => setService(e.target.value)} placeholder="mavproxy.service" className={`${inputCls} font-mono`} />
            </label>
          )}
          {(taskType === "download_logs" || taskType === "upload_file") && (
            <>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Remote path</span>
                <input value={remotePath} onChange={(e) => setRemotePath(e.target.value)} className={`${inputCls} font-mono`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Local path</span>
                <input value={localPath} onChange={(e) => setLocalPath(e.target.value)} className={`${inputCls} font-mono`} />
              </label>
            </>
          )}

          <div>
            <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Target devices</span>
            {devices.length === 0 ? (
              <div className="text-[12px] text-text-tertiary">No real devices added yet.</div>
            ) : (
              <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-border-default p-1.5">
                {devices.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-bg-hover">
                    <input type="checkbox" checked={selectedDevices.has(d.id)} onChange={() => toggleDevice(d.id)} />
                    {d.alias}
                    <span className="font-mono text-[11px] text-text-tertiary">{d.ip}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="mt-2 rounded-md border border-status-error/30 bg-status-error/10 px-2.5 py-1.5 text-[11px] text-status-error">{error}</div>}

        {destructive && !confirming ? (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" disabled={!canSubmit} onClick={() => setConfirming(true)}>
              Continue — this is destructive
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant={destructive ? "danger" : "primary"}
              size="sm"
              disabled={!canSubmit || busy}
              icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              onClick={handleCreate}
            >
              {destructive ? "Confirm & run" : "Create & run"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent";

export function TasksScreen() {
  const devices = useRealDevicesStore((s) => s.devices);
  const [tasks, setTasks] = useState<TaskWithRuns[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  function refresh() {
    setLoading(true);
    tasksApi
      .listTasks()
      .then(setTasks)
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  useEffect(() => {
    const unlisten = tasksApi.onTaskUpdate((taskId, runId, status) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.task.id === taskId
            ? { ...t, runs: t.runs.map((r) => (r.id === runId ? { ...r, status } : r)) }
            : t,
        ),
      );
    });
    return () => {
      unlisten.then((u) => u());
    };
  }, []);

  async function handleRetry(taskId: string) {
    await tasksApi.retryFailed(taskId);
    await tasksApi.runTask(taskId);
    refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[14px] font-semibold">Tasks & Automation</h1>
        <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setShowNew(true)} disabled={devices.length === 0}>
          New task
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-text-tertiary">
          <Loader2 size={13} className="animate-spin" /> Loading…
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={18} />}
          title="No tasks yet"
          detail={devices.length === 0 ? "Add a real device first." : 'Click "New task" to run something across your fleet.'}
        />
      ) : (
        tasks.map(({ task, runs }) => (
          <Card key={task.id}>
            <CardHeader
              title={task.name}
              subtitle={`${TASK_TYPE_LABEL[task.task_type]}${task.destructive ? " · destructive" : ""}`}
              action={
                runs.some((r) => r.status === "failed") ? (
                  <Button size="sm" variant="ghost" icon={<RotateCcw size={12} />} onClick={() => handleRetry(task.id)}>
                    Retry failed
                  </Button>
                ) : undefined
              }
            />
            <div className="divide-y divide-border-subtle">
              {runs.map((r) => {
                const device = devices.find((d) => d.id === r.device_id);
                return (
                  <div key={r.id} className="px-3 py-2 text-[13px]">
                    <div className="flex items-center gap-3">
                      <span className="w-40 truncate text-text-primary">{device?.alias ?? r.device_id}</span>
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                      {r.retry_count > 0 && <span className="text-[11px] text-text-tertiary">{r.retry_count} retries</span>}
                    </div>
                    {r.result_summary && (
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-bg-surface-2 px-2 py-1 font-mono text-[11px] text-text-secondary">
                        {r.result_summary}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}

      {showNew && (
        <NewTaskModal
          onClose={() => setShowNew(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
