import { useEffect, useState } from "react";
import { XCircle, RotateCw, Square, Power, Loader2 } from "lucide-react";
import { processes as mockProcesses, services as mockServices } from "../../mocks/data";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { cn } from "../../lib/cn";
import { useDeviceConnection } from "../../lib/useDevice";
import { execCommand } from "../../ipc/ssh";
import type { ProcessRow, ServiceRow } from "../../mocks/types";

function parsePs(raw: string): ProcessRow[] {
  return raw
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const cols = line.trim().split(/\s+/);
      const [pid, name, cpu, rss, user] = cols;
      return {
        pid: Number(pid) || 0,
        name: name ?? "?",
        cpuPct: Number(cpu) || 0,
        ramMb: Math.round((Number(rss) || 0) / 1024),
        user: user ?? "?",
      };
    })
    .filter((p) => p.pid > 0);
}

function parseServices(raw: string): ServiceRow[] {
  return raw
    .trim()
    .split("\n")
    .map((line) => {
      const cols = line.trim().split(/\s+/);
      const name = cols[0] ?? "";
      const sub = cols[3] ?? "";
      const status: ServiceRow["status"] = sub === "running" ? "active" : sub === "failed" ? "failed" : "inactive";
      return { name, status, enabled: true };
    })
    .filter((s) => s.name.endsWith(".service"));
}

export function ProcessesServicesScreen() {
  const [tab, setTab] = useState<"processes" | "services">("processes");
  const connection = useDeviceConnection();
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const command =
      tab === "processes"
        ? "ps -eo pid,comm,pcpu,rss,user --sort=-pcpu --no-headers | head -20 | awk 'BEGIN{print \"PID COMMAND CPU RSS USER\"}{print}'"
        : "systemctl list-units --type=service --no-pager --no-legend --plain | head -30";
    execCommand(connection, command)
      .then((res) => {
        if (cancelled) return;
        if (tab === "processes") setProcesses(parsePs(res.stdout));
        else setServices(parseServices(res.stdout));
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [connection, tab]);

  const rows = connection ? { processes, services } : { processes: mockProcesses, services: mockServices };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex gap-1">
        {(["processes", "services"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12px] font-medium capitalize",
              tab === t ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-bg-hover",
            )}
          >
            {t}
          </button>
        ))}
        {connection && <Badge variant="accent" className="ml-1 self-center">live via SSH</Badge>}
      </div>

      {tab === "processes" ? (
        <Card>
          <CardHeader title="Processes" subtitle={connection ? "ps -eo pid,comm,pcpu,rss,user" : `${rows.processes.length} running`} />
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-text-tertiary">
              <Loader2 size={13} className="animate-spin" /> Running ps over SSH…
            </div>
          )}
          {error && <div className="px-3 py-3 text-[12px] text-status-error">{error}</div>}
          {!loading && !error && rows.processes.length === 0 && connection && (
            <EmptyState title="No process data yet" detail="Switch tabs or reconnect to refresh." />
          )}
          {!loading && rows.processes.length > 0 && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wide text-text-tertiary">
                  <th className="px-3 py-2 font-medium">PID</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">CPU %</th>
                  <th className="px-3 py-2 font-medium">RAM</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.processes.map((p) => (
                  <tr key={p.pid} className="border-b border-border-subtle last:border-0 hover:bg-bg-hover">
                    <td className="px-3 py-2 font-mono text-[12px] text-text-tertiary">{p.pid}</td>
                    <td className="px-3 py-2 font-mono text-[12px] text-text-primary">{p.name}</td>
                    <td className="px-3 py-2 text-text-secondary">{p.user}</td>
                    <td className="px-3 py-2 text-text-secondary">{p.cpuPct.toFixed(1)}</td>
                    <td className="px-3 py-2 text-text-secondary">{p.ramMb} MB</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="danger" icon={<XCircle size={12} />} disabled title="Kill not implemented yet — read-only for now">
                        Kill
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="systemd services" subtitle={connection ? "systemctl list-units --type=service" : undefined} />
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-text-tertiary">
              <Loader2 size={13} className="animate-spin" /> Querying systemd over SSH…
            </div>
          )}
          {error && <div className="px-3 py-3 text-[12px] text-status-error">{error}</div>}
          {!loading && !error && rows.services.length === 0 && connection && (
            <EmptyState title="No services returned" />
          )}
          <div className="divide-y divide-border-subtle">
            {!loading &&
              rows.services.map((s) => (
                <div key={s.name} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                  <span className="flex-1 font-mono text-[12px] text-text-primary">{s.name}</span>
                  <Badge variant={s.status === "active" ? "success" : s.status === "failed" ? "error" : "neutral"}>
                    {s.status}
                  </Badge>
                  {!s.enabled && <Badge>disabled</Badge>}
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={<RotateCw size={12} />} disabled title="Not implemented yet — read-only for now" />
                    <Button size="sm" variant="ghost" icon={<Square size={12} />} disabled title="Not implemented yet — read-only for now" />
                    <Button size="sm" variant="ghost" icon={<Power size={12} />} disabled title="Not implemented yet — read-only for now" />
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
