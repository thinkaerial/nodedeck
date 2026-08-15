import { useEffect, useRef, useState, type ReactNode } from "react";
import { Thermometer, Cpu, MemoryStick, Loader2, Play } from "lucide-react";
import { useDevice, useDeviceConnection } from "../../lib/useDevice";
import { StatTile } from "../../components/ui/StatTile";
import { Card, CardHeader } from "../../components/ui/Card";
import { Sparkline } from "../../components/ui/Sparkline";
import { Button } from "../../components/ui/Button";
import { quickCommands } from "../../mocks/data";
import { Badge } from "../../components/ui/Badge";
import { getSnapshot } from "../../ipc/monitor";
import { execCommand } from "../../ipc/ssh";
import type { MonitorSnapshot } from "../../ipc/types";

export function DeviceOverviewScreen() {
  const device = useDevice();
  const connection = useDeviceConnection();

  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const memHistory = useRef<number[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [output, setOutput] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    async function poll() {
      try {
        const snap = await getSnapshot(connection!);
        if (cancelled) return;
        setSnapshot(snap);
        const pct = snap.mem_total_mb > 0 ? Math.round((snap.mem_used_mb / snap.mem_total_mb) * 100) : 0;
        memHistory.current = [...memHistory.current.slice(-29), pct];
      } catch {
        // Monitor tab shows the error state; this is just a quick glance.
      }
    }
    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connection]);

  async function runQuickCommand(id: string, command: string) {
    if (!connection) return;
    setRunningId(id);
    setOutput(null);
    try {
      const result = await execCommand(connection, command);
      setOutput({ id, text: (result.stdout || "") + (result.stderr ? `\n${result.stderr}` : "") || "(no output)" });
    } catch (e) {
      setOutput({ id, text: `error: ${String(e)}` });
    } finally {
      setRunningId(null);
    }
  }

  const memPct =
    connection && snapshot && snapshot.mem_total_mb > 0
      ? Math.round((snapshot.mem_used_mb / snapshot.mem_total_mb) * 100)
      : device.ramPct;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label={connection ? "Load (1m)" : "CPU"} value={connection ? (snapshot?.load_1m.toFixed(2) ?? "—") : (device.cpuPct ?? "—")} unit={connection ? undefined : "%"} icon={<Cpu size={14} />} />
        <StatTile label="RAM" value={memPct ?? "—"} unit="%" icon={<MemoryStick size={14} />} />
        <StatTile
          label="Temperature"
          value={connection ? (snapshot?.temp_c?.toFixed(1) ?? "—") : (device.tempC ?? "—")}
          unit="°C"
          tone={(connection ? snapshot?.temp_c : device.tempC) && (connection ? snapshot!.temp_c! : device.tempC!) > 65 ? "warning" : "neutral"}
          icon={<Thermometer size={14} />}
        />
      </div>

      {connection ? (
        memHistory.current.length > 1 && (
          <Card>
            <CardHeader title="RAM — live" subtitle="Polled every 8s over SSH" />
            <div className="p-3">
              <Sparkline data={memHistory.current} width={600} height={80} className="w-full" />
            </div>
          </Card>
        )
      ) : (
        device.cpuHistory && (
          <Card>
            <CardHeader title="CPU — last 2 minutes" />
            <div className="p-3">
              <Sparkline data={device.cpuHistory} width={600} height={80} className="w-full" />
            </div>
          </Card>
        )
      )}

      <Card>
        <CardHeader
          title="Quick commands"
          subtitle={connection ? "Runs over SSH, output shown below" : "Connect a real device to run these"}
        />
        <div className="divide-y divide-border-subtle">
          {quickCommands.map((qc) => (
            <div key={qc.id}>
              <div className="flex items-center justify-between px-3 py-2 text-[13px]">
                <span className="text-text-primary">{qc.label}</span>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-secondary">
                    {qc.command}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!connection || runningId === qc.id}
                    icon={runningId === qc.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    onClick={() => runQuickCommand(qc.id, qc.command)}
                  />
                </div>
              </div>
              {output?.id === qc.id && (
                <pre className="mx-3 mb-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[#0a0c11] p-2 font-mono text-[11px] text-[#c9d1d9]">
                  {output.text}
                </pre>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Connection profile" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 text-[13px]">
          <Row label="SSH port" value={String(connection?.port ?? device.sshPort)} />
          <Row label="Username" value={connection?.username ?? "—"} />
          <Row label="Auth method" value={connection ? "Password" : "—"} />
          <Row
            label="Tags"
            value={
              device.tags.length ? (
                <div className="flex gap-1">
                  {device.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              ) : (
                "—"
              )
            }
          />
          <Row label="MAC vendor" value={device.macVendor ?? "Unknown"} />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-1.5 last:border-0">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}
