import { Link } from "react-router-dom";
import { Server, Wifi, ShieldAlert, Radar, ArrowRight } from "lucide-react";
import { tasks, auditLog } from "../../mocks/data";
import { useAllDevices } from "../../lib/useAllDevices";
import { useUIStore } from "../../state/store";
import { StatTile } from "../../components/ui/StatTile";
import { Card, CardHeader } from "../../components/ui/Card";
import { StatusDot, statusLabel } from "../../components/ui/StatusDot";
import { Sparkline } from "../../components/ui/Sparkline";
import { EmptyState } from "../../components/ui/EmptyState";
import { DEVICE_TYPE_ICON } from "../../lib/deviceMeta";
import { Button } from "../../components/ui/Button";

export function DashboardScreen() {
  const devices = useAllDevices();
  const showDemo = useUIStore((s) => s.showDemoDevices);
  const online = devices.filter((d) => d.status === "online").length;
  const warning = devices.filter((d) => d.status === "warning").length;
  const offline = devices.filter((d) => d.status === "offline").length;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Devices online" value={online} unit={`/ ${devices.length}`} icon={<Server size={14} />} />
        <StatTile
          label="Needs attention"
          value={warning}
          tone={warning > 0 ? "warning" : "neutral"}
          icon={<ShieldAlert size={14} />}
        />
        <StatTile label="Offline" value={offline} icon={<Wifi size={14} />} />
        <StatTile
          label="Active tasks"
          value={showDemo ? tasks.filter((t) => t.results.some((r) => r.status === "running")).length : 0}
          icon={<Radar size={14} />}
        />
      </div>

      <Card>
        <CardHeader
          title="Devices"
          subtitle="Grouped by health — click through to Device Detail"
          action={
            <Link to="/devices">
              <Button size="sm" variant="ghost" icon={<ArrowRight size={13} />}>
                View all
              </Button>
            </Link>
          }
        />
        <div className="divide-y divide-border-subtle">
          {devices.map((d) => {
            const Icon = DEVICE_TYPE_ICON[d.deviceType];
            return (
              <Link
                key={d.id}
                to={`/devices/${d.id}`}
                className="flex items-center gap-3 px-3 py-2.5 text-[13px] hover:bg-bg-hover"
              >
                <StatusDot status={d.status} />
                <Icon size={15} className="text-text-tertiary" />
                <span className="w-40 truncate font-medium text-text-primary">{d.alias}</span>
                <span className="w-32 font-mono text-[11px] text-text-tertiary">{d.ip}</span>
                <span className="w-20 text-[11px] text-text-tertiary">{statusLabel(d.status)}</span>
                {d.cpuHistory && (
                  <Sparkline data={d.cpuHistory} className="ml-2" />
                )}
                <span className="ml-auto text-[11px] text-text-tertiary">{d.lastSeen}</span>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Recent task runs" subtitle="Latest fleet operations" />
          {!showDemo ? (
            <EmptyState title="No task runs yet" detail="Fleet tasks aren't implemented yet." />
          ) : (
            <div className="divide-y divide-border-subtle">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2.5 text-[12px]">
                  <div>
                    <div className="font-medium text-text-primary">{t.name}</div>
                    <div className="text-[11px] text-text-tertiary">{t.targetLabel} · {t.createdAt}</div>
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {t.results.filter((r) => r.status === "success").length}/{t.results.length} ok
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Audit log" subtitle="Sensitive operations" />
          {!showDemo ? (
            <EmptyState title="No audit entries yet" detail="Audit logging isn't implemented yet." />
          ) : (
            <div className="divide-y divide-border-subtle">
              {auditLog.map((a) => (
                <div key={a.id} className="px-3 py-2.5 text-[12px]">
                  <div className="text-text-primary">
                    <span className="font-medium">{a.actor}</span> — {a.action.replaceAll("_", " ")}
                  </div>
                  <div className="text-[11px] text-text-tertiary">{a.target} · {a.at}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
