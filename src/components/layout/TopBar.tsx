import { Menu, Search, Wifi } from "lucide-react";
import { useUIStore } from "../../state/store";
import { useAllDevices } from "../../lib/useAllDevices";
import { Button } from "../ui/Button";

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const devices = useAllDevices();
  const online = devices.filter((d) => d.status === "online").length;

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border-subtle bg-bg-surface px-3">
      <Button variant="ghost" size="sm" onClick={toggleSidebar} aria-label="Toggle sidebar">
        <Menu size={15} />
      </Button>

      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex h-7 flex-1 max-w-md items-center gap-2 rounded-md border border-border-default bg-bg-base px-2.5 text-[12px] text-text-tertiary transition-colors hover:border-border-strong"
      >
        <Search size={13} />
        <span>Search devices, run a command…</span>
        <kbd className="ml-auto rounded border border-border-default bg-bg-surface-2 px-1 py-0.5 font-mono text-[10px] text-text-tertiary">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2 text-[11px] text-text-tertiary">
        <Wifi size={13} className={online > 0 ? "text-status-online" : "text-text-tertiary"} />
        <span>
          {devices.length} device{devices.length === 1 ? "" : "s"} · {online} online
        </span>
      </div>
    </header>
  );
}
