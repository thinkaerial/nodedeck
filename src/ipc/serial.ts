import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SerialPortEntry {
  path: string;
  label: string;
}

export const listPorts = (): Promise<SerialPortEntry[]> => invoke("serial_list_ports");

export const openPort = (
  path: string,
  baudRate: number,
  parity: string,
  stopBits: string,
  flowControl: string,
): Promise<string> => invoke("serial_open", { path, baudRate, parity, stopBits, flowControl });

export const writePort = (sessionId: string, data: string): Promise<void> =>
  invoke("serial_write", { sessionId, data });

export const closePort = (sessionId: string): Promise<void> => invoke("serial_close", { sessionId });

export function onSerialData(cb: (sessionId: string, data: string) => void): Promise<UnlistenFn> {
  return listen<{ session_id: string; data: string }>("serial:data", (event) => {
    cb(event.payload.session_id, event.payload.data);
  });
}

export function onSerialClosed(cb: (sessionId: string) => void): Promise<UnlistenFn> {
  return listen<{ session_id: string }>("serial:closed", (event) => cb(event.payload.session_id));
}
