import { invoke } from "@tauri-apps/api/core";

export interface CommandOutput {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export const ping = (target: string): Promise<CommandOutput> => invoke("net_ping", { target });
export const dnsLookup = (target: string): Promise<CommandOutput> => invoke("net_dns_lookup", { target });
export const arpTable = (): Promise<CommandOutput> => invoke("net_arp_table");
export const portCheck = (target: string, port: number): Promise<CommandOutput> =>
  invoke("net_port_check", { target, port });
export const traceroute = (target: string): Promise<CommandOutput> => invoke("net_traceroute", { target });
