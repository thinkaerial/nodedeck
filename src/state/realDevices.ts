import { create } from "zustand";
import type { Device, DeviceType } from "../mocks/types";
import type { ConnectionParams } from "../ipc/types";
import * as db from "../ipc/db";

export interface RealDevice extends Device {
  isReal: true;
  connection: ConnectionParams;
}

function toDbDevice(d: RealDevice): db.DbDevice {
  return {
    id: d.id,
    alias: d.alias,
    device_type: d.deviceType,
    ip: d.ip,
    hostname: d.hostname,
    mac_vendor: d.macVendor ?? null,
    group_id: d.groupId ?? null,
    tags: d.tags,
    ssh_port: d.sshPort,
    username: d.connection.username,
    password: d.connection.password,
    private_key_path: d.connection.private_key_path ?? null,
    private_key_passphrase: d.connection.private_key_passphrase ?? null,
  };
}

function fromDbDevice(row: db.DbDevice): RealDevice {
  return {
    id: row.id,
    alias: row.alias,
    deviceType: row.device_type as DeviceType,
    status: "connecting",
    ip: row.ip,
    hostname: row.hostname,
    macVendor: row.mac_vendor ?? undefined,
    groupId: row.group_id ?? "grp-real",
    tags: row.tags,
    lastSeen: "unknown",
    sshPort: row.ssh_port,
    isReal: true,
    connection: {
      host: row.ip,
      port: row.ssh_port,
      username: row.username,
      password: row.password,
      private_key_path: row.private_key_path ?? undefined,
      private_key_passphrase: row.private_key_passphrase ?? undefined,
    },
  };
}

/** One-time migration from the old localStorage-only persistence. */
const LEGACY_KEY = "nodedeck-real-devices";
function migrateLegacyLocalStorage(): RealDevice[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const devices: RealDevice[] = parsed?.state?.devices ?? [];
    localStorage.removeItem(LEGACY_KEY);
    return devices;
  } catch {
    return [];
  }
}

interface RealDevicesState {
  devices: RealDevice[];
  loaded: boolean;
  loadFromDb: () => Promise<void>;
  addDevice: (device: RealDevice) => void;
  updateDevice: (id: string, patch: Partial<RealDevice>) => void;
  setStatus: (id: string, status: RealDevice["status"], lastSeen?: string) => void;
  removeDevice: (id: string) => void;
}

/**
 * Backed by embedded SQLite (`core/db.rs` — bundled SQLite, no separate
 * install), not local storage. `loadFromDb` hydrates on app start and
 * migrates any devices left over from the pre-SQLite localStorage-only
 * version. Every write here also writes through to the DB — for a handful
 * of devices at typical heartbeat/edit frequency this is cheap and keeps the
 * logic simple; split into a separate "persist" method later if it ever
 * shows up as a real cost.
 */
export const useRealDevicesStore = create<RealDevicesState>((set, get) => ({
  devices: [],
  loaded: false,
  loadFromDb: async () => {
    try {
      const rows = await db.listDevices();
      let devices = rows.map(fromDbDevice);
      if (devices.length === 0) {
        const legacy = migrateLegacyLocalStorage();
        if (legacy.length > 0) {
          await Promise.all(legacy.map((d) => db.saveDevice(toDbDevice(d)).catch(() => {})));
          devices = legacy;
        }
      }
      set({ devices, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  addDevice: (device) => {
    set((s) => ({ devices: [...s.devices.filter((d) => d.id !== device.id), device] }));
    db.saveDevice(toDbDevice(device)).catch(() => {});
  },
  updateDevice: (id, patch) => {
    set((s) => ({
      devices: s.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
    const updated = get().devices.find((d) => d.id === id);
    if (updated) db.saveDevice(toDbDevice(updated)).catch(() => {});
  },
  // In-memory only, deliberately not persisted — status/lastSeen are derived
  // from live reachability checks (heartbeat, reconnect), not real device
  // config, so writing them to SQLite on every 20s heartbeat tick for every
  // saved device was pure overhead with no value (they'd be stale the next
  // time the app opens anyway).
  setStatus: (id, status, lastSeen) => {
    set((s) => ({
      devices: s.devices.map((d) => (d.id === id ? { ...d, status, ...(lastSeen ? { lastSeen } : {}) } : d)),
    }));
  },
  removeDevice: (id) => {
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id) }));
    db.deleteDevice(id).catch(() => {});
  },
}));
