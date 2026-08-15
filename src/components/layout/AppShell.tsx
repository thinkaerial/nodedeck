import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "../command-palette/CommandPalette";
import { useDeviceHeartbeat } from "../../lib/useDeviceHeartbeat";
import { useRealDevicesStore } from "../../state/realDevices";

export function AppShell() {
  useDeviceHeartbeat();
  const loadFromDb = useRealDevicesStore((s) => s.loadFromDb);

  useEffect(() => {
    loadFromDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base text-text-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
