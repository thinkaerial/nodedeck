import { create } from "zustand";
import type { DiscoveredDevice } from "../ipc/discovery";

interface NetworkScannerState {
  cidr: string;
  results: DiscoveredDevice[] | null;
  scannedAt: number | null;
  setCidr: (cidr: string) => void;
  setResults: (results: DiscoveredDevice[]) => void;
}

// Module-level Zustand store (not component state) so scan results survive
// navigating away to another screen and back — previously this lived in
// NetworkScannerScreen's useState and was lost on unmount.
export const useNetworkScannerStore = create<NetworkScannerState>((set) => ({
  cidr: "",
  results: null,
  scannedAt: null,
  setCidr: (cidr) => set({ cidr }),
  setResults: (results) => set({ results, scannedAt: Date.now() }),
}));
