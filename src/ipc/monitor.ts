import { invoke } from "@tauri-apps/api/core";
import type { ConnectionParams, MonitorSnapshot } from "./types";

export function getSnapshot(params: ConnectionParams): Promise<MonitorSnapshot> {
  return invoke("monitor_snapshot", { params });
}
