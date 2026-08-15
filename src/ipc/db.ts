import { invoke } from "@tauri-apps/api/core";

export interface DbDevice {
  id: string;
  alias: string;
  device_type: string;
  ip: string;
  hostname: string;
  mac_vendor: string | null;
  group_id: string | null;
  tags: string[];
  ssh_port: number;
  username: string;
  password: string;
  private_key_path: string | null;
  private_key_passphrase: string | null;
}

export const listDevices = (): Promise<DbDevice[]> => invoke("db_list_devices");
export const saveDevice = (device: DbDevice): Promise<void> => invoke("db_save_device", { device });
export const deleteDevice = (id: string): Promise<void> => invoke("db_delete_device", { id });
