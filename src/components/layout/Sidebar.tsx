import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Radar,
  Server,
  ShieldCheck,
  Settings as SettingsIcon,
  ListChecks,
  Share2,
  Wrench,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { useUIStore } from "../../state/store";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/scanner", label: "Network Scanner", icon: Radar },
  { to: "/devices", label: "Devices", icon: Server },
  { to: "/network-tools", label: "Network Tools", icon: Wrench },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/shares", label: "Shares", icon: Share2 },
  { to: "/security", label: "Credentials & Security", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border-subtle bg-bg-surface transition-[width]",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className="flex h-11 items-center gap-2 border-b border-border-subtle px-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-[11px] font-bold text-accent-fg">
          N
        </div>
        {!collapsed && <span className="text-[13px] font-semibold tracking-tight">NodeDeck</span>}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={16} strokeWidth={2} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
