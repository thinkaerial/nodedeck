import { create } from "zustand";

interface SerialSessionState {
  selected: string | null;
  baudRate: string;
  parity: string;
  stopBits: string;
  flowControl: string;
  sessionId: string | null;
  lines: string[];
  setSelected: (path: string | null) => void;
  setConfig: (config: Partial<Pick<SerialSessionState, "baudRate" | "parity" | "stopBits" | "flowControl">>) => void;
  setSessionId: (id: string | null) => void;
  appendLine: (data: string) => void;
  resetLines: () => void;
}

// Module-level store, not component state: previously SerialScreen closed
// the live serial session in a cleanup effect on unmount, so just switching
// to another tab (Terminal, Files, ...) and back silently dropped the
// connection. Session id + read buffer now survive navigation; the port is
// only actually closed when the user clicks "Close session".
export const useSerialSessionStore = create<SerialSessionState>((set) => ({
  selected: null,
  baudRate: "57600",
  parity: "none",
  stopBits: "1",
  flowControl: "none",
  sessionId: null,
  lines: [],
  setSelected: (path) => set({ selected: path }),
  setConfig: (config) => set(config),
  setSessionId: (id) => set({ sessionId: id }),
  appendLine: (data) => set((s) => ({ lines: [...s.lines.slice(-500), data] })),
  resetLines: () => set({ lines: [] }),
}));
