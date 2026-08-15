import { invoke } from "@tauri-apps/api/core";

export interface LocalEntry {
  name: string;
  is_dir: boolean;
  size: number | null;
}

export const homeDir = (): Promise<string | null> => invoke("local_home_dir");
export const listDir = (path: string): Promise<LocalEntry[]> => invoke("local_list_dir", { path });
