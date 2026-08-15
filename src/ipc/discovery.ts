import { invoke } from "@tauri-apps/api/core";

export interface DiscoveredDevice {
  ip: string;
  mac: string | null;
  vendor: string | null;
  ssh_open: boolean;
  latency_ms: number | null;
}

export const getDefaultCidr = (): Promise<string | null> => invoke("discovery_default_cidr");
export const scan = (cidr: string): Promise<DiscoveredDevice[]> => invoke("discovery_scan", { cidr });
