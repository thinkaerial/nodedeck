import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  selectedDeviceId: string | null;
  showDemoDevices: boolean;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setShowDemoDevices: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  selectedDeviceId: null,
  showDemoDevices: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  setShowDemoDevices: (show) => set({ showDemoDevices: show }),
}));
