import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Server, LayoutDashboard, Radar, ListChecks, Share2, ShieldCheck, Settings } from "lucide-react";
import { useUIStore } from "../../state/store";
import { useAllDevices } from "../../lib/useAllDevices";

interface Entry {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Server;
  action: () => void;
}

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const devices = useAllDevices();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const entries: Entry[] = useMemo(
    () => [
      { id: "nav-dash", label: "Go to Dashboard", icon: LayoutDashboard, action: () => navigate("/") },
      { id: "nav-scan", label: "Go to Network Scanner", icon: Radar, action: () => navigate("/scanner") },
      { id: "nav-tasks", label: "Go to Tasks", icon: ListChecks, action: () => navigate("/tasks") },
      { id: "nav-shares", label: "Go to Shares", icon: Share2, action: () => navigate("/shares") },
      { id: "nav-sec", label: "Go to Credentials & Security", icon: ShieldCheck, action: () => navigate("/security") },
      { id: "nav-settings", label: "Go to Settings", icon: Settings, action: () => navigate("/settings") },
      ...devices.map((d) => ({
        id: `dev-${d.id}`,
        label: `Open ${d.alias}`,
        hint: d.ip,
        icon: Server,
        action: () => navigate(`/devices/${d.id}`),
      })),
    ],
    [navigate, devices],
  );

  const filtered = entries.filter((e) => e.label.toLowerCase().includes(query.toLowerCase()));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border-default bg-bg-overlay shadow-[var(--shadow-2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search devices, run a command…"
          className="w-full border-b border-border-subtle bg-transparent px-3.5 py-3 text-[13px] text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-text-tertiary">No results</div>
          )}
          {filtered.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                entry.action();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-text-primary hover:bg-bg-hover"
            >
              <entry.icon size={14} className="text-text-tertiary" />
              <span className="flex-1">{entry.label}</span>
              {entry.hint && <span className="font-mono text-[11px] text-text-tertiary">{entry.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
