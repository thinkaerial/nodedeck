export interface ConnectionParams {
  host: string;
  port: number;
  username: string;
  /** Ignored when private_key_path is set. */
  password: string;
  /** Path to an OpenSSH-format private key (id_rsa, id_ed25519, …). When set, authenticates with this instead of password. */
  private_key_path?: string | null;
  private_key_passphrase?: string | null;
}

export interface TestConnectionResult {
  output: string;
  exit_code: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export interface MonitorSnapshot {
  load_1m: number;
  mem_total_mb: number;
  mem_used_mb: number;
  disk_total: string;
  disk_used: string;
  disk_used_pct: number;
  temp_c: number | null;
  uptime_seconds: number;
  raw: string;
}

export interface SftpEntry {
  name: string;
  is_dir: boolean;
  size: number | null;
}
