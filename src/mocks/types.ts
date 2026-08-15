export type DeviceType =
  | "raspberry_pi"
  | "jetson"
  | "radxa"
  | "luckfox"
  | "linux_pc"
  | "windows_pc"
  | "unknown";

export type DeviceStatus = "online" | "offline" | "connecting" | "warning";

export interface Device {
  id: string;
  alias: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  ip: string;
  hostname: string;
  macVendor?: string;
  latencyMs?: number;
  groupId: string;
  tags: string[];
  lastSeen: string;
  cpuPct?: number;
  ramPct?: number;
  tempC?: number;
  sshPort: number;
  cpuHistory?: number[];
}

export interface DeviceGroup {
  id: string;
  name: string;
  parentGroupId?: string;
}

export type TaskStatus = "queued" | "running" | "success" | "failed" | "skipped";

export interface FleetTask {
  id: string;
  name: string;
  taskType:
    | "upload_file"
    | "download_logs"
    | "restart_service"
    | "run_command"
    | "check_disk"
    | "collect_diagnostics";
  targetLabel: string;
  destructive: boolean;
  createdAt: string;
  results: { deviceId: string; status: TaskStatus; retries: number }[];
}

export interface ShareLink {
  id: string;
  fileName: string;
  sourcePath: string;
  deviceId?: string;
  url: string;
  passwordProtected: boolean;
  expiresAt?: string;
  downloadLimit?: number;
  downloadCount: number;
  revoked: boolean;
  createdAt: string;
}

export interface ProcessRow {
  pid: number;
  name: string;
  cpuPct: number;
  ramMb: number;
  user: string;
}

export interface ServiceRow {
  name: string;
  status: "active" | "inactive" | "failed";
  enabled: boolean;
}

export interface LogLine {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  unit: string;
  message: string;
}

export interface SerialPort {
  path: string;
  label: string;
  connected: boolean;
}

export interface NetworkInterfaceInfo {
  name: string;
  ip: string;
  mac: string;
  type: "wifi" | "ethernet";
  rxKbps: number;
  txKbps: number;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target?: string;
  at: string;
}

export interface QuickCommand {
  id: string;
  label: string;
  command: string;
}
