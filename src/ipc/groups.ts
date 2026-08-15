import { invoke } from "@tauri-apps/api/core";

export interface DbGroup {
  id: string;
  name: string;
}

export const listGroups = (): Promise<DbGroup[]> => invoke("db_list_groups");
export const createGroup = (name: string): Promise<DbGroup> => invoke("db_create_group", { name });
export const deleteGroup = (id: string): Promise<void> => invoke("db_delete_group", { id });

export const importDevices = (filePath: string): Promise<number> => invoke("db_import_devices", { filePath });
export const exportDevices = (filePath: string): Promise<void> => invoke("db_export_devices", { filePath });

export interface DbAuditEntry {
  id: number;
  actor: string;
  action: string;
  target: string | null;
  at: number;
}

export const listAuditLog = (): Promise<DbAuditEntry[]> => invoke("db_list_audit_log");
