import { useMemo } from "react";
import { devices as mockDevices } from "../mocks/data";
import { useRealDevicesStore } from "../state/realDevices";
import { useUIStore } from "../state/store";
import type { Device } from "../mocks/types";

/**
 * Once a real device has been added, demo/mock devices are hidden by default —
 * they're only useful for browsing the UI before real hardware is connected,
 * and become confusing clutter once actual devices are in the list.
 * `showDemoDevices` in the UI store lets a user bring them back.
 */
export function useAllDevices(): Device[] {
  const real = useRealDevicesStore((s) => s.devices);
  const showDemo = useUIStore((s) => s.showDemoDevices);
  return useMemo(() => [...real, ...(showDemo ? mockDevices : [])], [real, showDemo]);
}
