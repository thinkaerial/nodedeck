import { create } from "zustand";

interface FilesBrowserState {
  // Keyed by device id so switching devices doesn't mix up paths, and
  // leaving/re-entering the Files tab for the same device keeps browsing
  // from where you left off instead of resetting to the home/root dir.
  remotePathByDevice: Record<string, string>;
  localPath: string | null;
  setRemotePath: (deviceId: string, path: string) => void;
  setLocalPath: (path: string) => void;
}

export const useFilesBrowserStore = create<FilesBrowserState>((set) => ({
  remotePathByDevice: {},
  localPath: null,
  setRemotePath: (deviceId, path) =>
    set((s) => ({ remotePathByDevice: { ...s.remotePathByDevice, [deviceId]: path } })),
  setLocalPath: (path) => set({ localPath: path }),
}));
