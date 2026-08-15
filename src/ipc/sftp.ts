import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ConnectionParams, SftpEntry } from "./types";

export function listDir(params: ConnectionParams, path: string): Promise<SftpEntry[]> {
  return invoke("sftp_list_dir", { params, path });
}

export function uploadFile(
  params: ConnectionParams,
  localPath: string,
  remotePath: string,
  transferId: string,
): Promise<void> {
  return invoke("sftp_upload", { params, localPath, remotePath, transferId });
}

export function downloadFile(
  params: ConnectionParams,
  remotePath: string,
  localPath: string,
  transferId: string,
): Promise<void> {
  return invoke("sftp_download", { params, remotePath, localPath, transferId });
}

export function onTransferProgress(
  cb: (transferId: string, sent: number, total: number) => void,
): Promise<UnlistenFn> {
  return listen<{ transfer_id: string; sent: number; total: number }>("transfer:progress", (event) => {
    cb(event.payload.transfer_id, event.payload.sent, event.payload.total);
  });
}
