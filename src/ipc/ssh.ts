import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ConnectionParams, ExecResult, TestConnectionResult } from "./types";

export function testConnection(params: ConnectionParams): Promise<TestConnectionResult> {
  return invoke("ssh_test_connection", { params });
}

export function execCommand(params: ConnectionParams, command: string): Promise<ExecResult> {
  return invoke("ssh_exec", { params, command });
}

export function openPty(params: ConnectionParams): Promise<string> {
  return invoke("ssh_pty_open", { params });
}

export function writePty(sessionId: string, data: string): Promise<void> {
  return invoke("ssh_pty_write", { sessionId, data });
}

export function resizePty(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke("ssh_pty_resize", { sessionId, cols, rows });
}

export function closePty(sessionId: string): Promise<void> {
  return invoke("ssh_pty_close", { sessionId });
}

export function onPtyData(cb: (sessionId: string, data: string) => void): Promise<UnlistenFn> {
  return listen<{ session_id: string; data: string }>("pty:data", (event) => {
    cb(event.payload.session_id, event.payload.data);
  });
}

export function onPtyClosed(cb: (sessionId: string) => void): Promise<UnlistenFn> {
  return listen<{ session_id: string }>("pty:closed", (event) => cb(event.payload.session_id));
}

export function onPtyError(cb: (sessionId: string, message: string) => void): Promise<UnlistenFn> {
  return listen<[string, string]>("pty:error", (event) => cb(event.payload[0], event.payload[1]));
}
