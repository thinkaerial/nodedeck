import type {
  AuditEntry,
  Device,
  DeviceGroup,
  FleetTask,
  LogLine,
  ProcessRow,
  QuickCommand,
  SerialPort,
  ServiceRow,
  ShareLink,
} from "./types";

function history(base: number, spread: number, n = 24) {
  return Array.from({ length: n }, () =>
    Math.max(2, Math.min(98, Math.round(base + (Math.random() - 0.5) * spread))),
  );
}

export const groups: DeviceGroup[] = [
  { id: "grp-drones", name: "Drone Companion Computers" },
  { id: "grp-edge", name: "Edge AI Rigs" },
  { id: "grp-lab", name: "Lab Bench" },
];

export const devices: Device[] = [
  {
    id: "dev-1",
    alias: "drone-01-pi5",
    deviceType: "raspberry_pi",
    status: "online",
    ip: "192.168.1.42",
    hostname: "drone-01-pi5.local",
    macVendor: "Raspberry Pi Foundation",
    latencyMs: 4,
    groupId: "grp-drones",
    tags: ["field", "pixhawk"],
    lastSeen: "just now",
    cpuPct: 34,
    ramPct: 58,
    tempC: 52,
    sshPort: 22,
    cpuHistory: history(34, 20),
  },
  {
    id: "dev-2",
    alias: "drone-02-pi5",
    deviceType: "raspberry_pi",
    status: "warning",
    ip: "192.168.1.43",
    hostname: "drone-02-pi5.local",
    macVendor: "Raspberry Pi Foundation",
    latencyMs: 11,
    groupId: "grp-drones",
    tags: ["field", "pixhawk"],
    lastSeen: "12s ago",
    cpuPct: 81,
    ramPct: 76,
    tempC: 71,
    sshPort: 22,
    cpuHistory: history(75, 25),
  },
  {
    id: "dev-3",
    alias: "jetson-orin-edge1",
    deviceType: "jetson",
    status: "online",
    ip: "192.168.1.60",
    hostname: "jetson-orin-edge1.local",
    macVendor: "NVIDIA",
    latencyMs: 6,
    groupId: "grp-edge",
    tags: ["vision", "gpu"],
    lastSeen: "just now",
    cpuPct: 45,
    ramPct: 63,
    tempC: 58,
    sshPort: 22,
    cpuHistory: history(45, 15),
  },
  {
    id: "dev-4",
    alias: "radxa-rock5-01",
    deviceType: "radxa",
    status: "offline",
    ip: "192.168.1.71",
    hostname: "radxa-rock5-01.local",
    macVendor: "Radxa",
    groupId: "grp-edge",
    tags: ["spare"],
    lastSeen: "2h ago",
    sshPort: 22,
  },
  {
    id: "dev-5",
    alias: "luckfox-pico-a",
    deviceType: "luckfox",
    status: "online",
    ip: "192.168.1.80",
    hostname: "luckfox-pico-a.local",
    latencyMs: 9,
    groupId: "grp-lab",
    tags: ["sensor"],
    lastSeen: "just now",
    cpuPct: 18,
    ramPct: 40,
    tempC: 44,
    sshPort: 22,
    cpuHistory: history(18, 10),
  },
  {
    id: "dev-6",
    alias: "bench-linux-01",
    deviceType: "linux_pc",
    status: "connecting",
    ip: "192.168.1.90",
    hostname: "bench-linux-01.local",
    groupId: "grp-lab",
    tags: [],
    lastSeen: "3m ago",
    sshPort: 22,
  },
];

export const quickCommands: QuickCommand[] = [
  { id: "qc-1", label: "Disk usage", command: "df -h" },
  { id: "qc-2", label: "Uptime", command: "uptime" },
  { id: "qc-3", label: "List services", command: "systemctl list-units --type=service" },
  { id: "qc-4", label: "Kernel + arch", command: "uname -a" },
];

export const processes: ProcessRow[] = [
  { pid: 1421, name: "mavproxy.py", cpuPct: 22.4, ramMb: 148, user: "pi" },
  { pid: 982, name: "python3 vision_node.py", cpuPct: 61.2, ramMb: 512, user: "pi" },
  { pid: 210, name: "systemd-journald", cpuPct: 0.4, ramMb: 18, user: "root" },
  { pid: 3391, name: "sshd", cpuPct: 0.1, ramMb: 6, user: "root" },
  { pid: 44, name: "wpa_supplicant", cpuPct: 0.3, ramMb: 4, user: "root" },
];

export const services: ServiceRow[] = [
  { name: "mavproxy.service", status: "active", enabled: true },
  { name: "vision-node.service", status: "active", enabled: true },
  { name: "nodedeck-agent.service", status: "active", enabled: true },
  { name: "bluetooth.service", status: "inactive", enabled: false },
  { name: "telemetry-relay.service", status: "failed", enabled: true },
];

export const logs: LogLine[] = [
  { ts: "12:41:02", level: "info", unit: "mavproxy", message: "Heartbeat received from FC" },
  { ts: "12:41:05", level: "warn", unit: "vision-node", message: "Frame drop rate above 2%" },
  { ts: "12:41:09", level: "error", unit: "telemetry-relay", message: "Connection reset by peer" },
  { ts: "12:41:10", level: "info", unit: "systemd", message: "Started nodedeck-agent.service" },
  { ts: "12:41:14", level: "debug", unit: "vision-node", message: "Model inference: 38ms" },
];

export const serialPorts: SerialPort[] = [
  { path: "/dev/cu.usbserial-FT3ZZ1", label: "FTDI USB-Serial (Pixhawk)", connected: true },
  { path: "/dev/cu.usbmodem14201", label: "STMicroelectronics VCP", connected: false },
];

export const shares: ShareLink[] = [
  {
    id: "share-1",
    fileName: "flight_log_2026-08-14.bin",
    sourcePath: "/home/pi/logs/flight_log_2026-08-14.bin",
    deviceId: "dev-1",
    url: "https://share.nodedeck.app/s/9fJ2kQ",
    passwordProtected: true,
    expiresAt: "2026-08-22",
    downloadLimit: 5,
    downloadCount: 1,
    revoked: false,
    createdAt: "2026-08-15",
  },
  {
    id: "share-2",
    fileName: "vision_dataset.tar.gz",
    sourcePath: "/data/vision_dataset.tar.gz",
    deviceId: "dev-3",
    url: "https://share.nodedeck.app/s/72xLm9",
    passwordProtected: false,
    downloadCount: 3,
    revoked: false,
    createdAt: "2026-08-13",
  },
];

export const tasks: FleetTask[] = [
  {
    id: "task-1",
    name: "Collect diagnostics — all drones",
    taskType: "collect_diagnostics",
    targetLabel: "Drone Companion Computers",
    destructive: false,
    createdAt: "2026-08-15 09:10",
    results: [
      { deviceId: "dev-1", status: "success", retries: 0 },
      { deviceId: "dev-2", status: "success", retries: 0 },
    ],
  },
  {
    id: "task-2",
    name: "Restart telemetry-relay.service",
    taskType: "restart_service",
    targetLabel: "tag:pixhawk",
    destructive: true,
    createdAt: "2026-08-15 08:52",
    results: [
      { deviceId: "dev-1", status: "success", retries: 0 },
      { deviceId: "dev-2", status: "failed", retries: 2 },
    ],
  },
];

export const auditLog: AuditEntry[] = [
  { id: "a1", actor: "admin", action: "share_created", target: "flight_log_2026-08-14.bin", at: "2026-08-15 09:02" },
  { id: "a2", actor: "admin", action: "task_run", target: "Restart telemetry-relay.service", at: "2026-08-15 08:52" },
  { id: "a3", actor: "admin", action: "device_credential_updated", target: "drone-02-pi5", at: "2026-08-14 17:20" },
];
