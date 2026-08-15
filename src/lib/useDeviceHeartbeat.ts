import { useEffect } from "react";
import { useRealDevicesStore } from "../state/realDevices";
import { portCheck } from "../ipc/nettools";

const INTERVAL_MS = 20_000;

/**
 * Lightweight liveness check for saved real devices — a plain TCP connect to
 * the SSH port from this Mac, not a full SSH handshake. Runs app-wide so
 * status (online/offline) reflects reality even when you're not looking at
 * that device's screen.
 */
export function useDeviceHeartbeat() {
  const devices = useRealDevicesStore((s) => s.devices);
  const updateDevice = useRealDevicesStore((s) => s.updateDevice);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const current = useRealDevicesStore.getState().devices;
      await Promise.all(
        current.map(async (d) => {
          try {
            const result = await portCheck(d.connection.host, d.connection.port);
            if (cancelled) return;
            const reachable = result.exit_code === 0;
            updateDevice(d.id, {
              status: reachable ? "online" : "offline",
              lastSeen: reachable ? "just now" : d.lastSeen,
            });
          } catch {
            if (!cancelled) updateDevice(d.id, { status: "offline" });
          }
        }),
      );
    }

    check();
    const interval = setInterval(check, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices.length]);
}
