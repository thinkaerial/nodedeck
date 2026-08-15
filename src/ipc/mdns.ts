import { invoke } from "@tauri-apps/api/core";

export interface MdnsEntry {
  hostname: string;
  addresses: string[];
  port: number;
  service_type: string;
}

export const browse = (): Promise<MdnsEntry[]> => invoke("mdns_browse");
