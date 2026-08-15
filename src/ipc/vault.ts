import { invoke } from "@tauri-apps/api/core";

export const setVaultPassword = (deviceId: string, password: string): Promise<void> =>
  invoke("vault_set_password", { deviceId, password });

export const getVaultPassword = (deviceId: string): Promise<string | null> =>
  invoke("vault_get_password", { deviceId });

export const deleteVaultPassword = (deviceId: string): Promise<void> =>
  invoke("vault_delete_password", { deviceId });
