import { invoke } from "@tauri-apps/api/core";

export interface ShareRecord {
  id: string;
  file_name: string;
  token: string;
  password_protected: boolean;
  expires_at: number | null;
  download_limit: number | null;
  download_count: number;
  revoked: boolean;
  created_at: number;
  access_log: { at: number }[];
}

export interface CreateShareOptions {
  sourcePath: string;
  password?: string;
  expiresInSecs?: number;
  downloadLimit?: number;
}

export const createShare = (opts: CreateShareOptions): Promise<ShareRecord> =>
  invoke("share_create", {
    sourcePath: opts.sourcePath,
    password: opts.password || null,
    expiresInSecs: opts.expiresInSecs ?? null,
    downloadLimit: opts.downloadLimit ?? null,
  });

export const listShares = (): Promise<ShareRecord[]> => invoke("share_list");
export const revokeShare = (id: string): Promise<void> => invoke("share_revoke", { id });
export const lanBaseUrl = (): Promise<string | null> => invoke("share_lan_base_url");
