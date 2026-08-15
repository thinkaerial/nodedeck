import { invoke } from "@tauri-apps/api/core";

export const getKnownHostKey = (host: string, port: number): Promise<string | null> =>
  invoke("known_hosts_get", { host, port });

export const forgetKnownHostKey = (host: string, port: number): Promise<void> =>
  invoke("known_hosts_forget", { host, port });
