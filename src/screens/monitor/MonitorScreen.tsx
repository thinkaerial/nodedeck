import { useEffect, useRef, useState } from "react";
import { Cpu, MemoryStick, Thermometer, HardDrive, Clock, RefreshCw } from "lucide-react";
import { useDevice, useDeviceConnection } from "../../lib/useDevice";
import { StatTile } from "../../components/ui/StatTile";
import { Card, CardHeader } from "../../components/ui/Card";
import { Sparkline } from "../../components/ui/Sparkline";
import { getSnapshot } from "../../ipc/monitor";
import type { MonitorSnapshot } from "../../ipc/types";

function fakeSeries(base: number, spread: number) {
  return Array.from({ length: 30 }, () => Math.max(2, Math.min(98, Math.round(base + (Math.random() - 0.5) * spread))));
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function MonitorScreen() {
  const device = useDevice();
  const connection = useDeviceConnection();

  if (connection) return <RealMonitor host={device.ip} connection={connection} />;
  return <MockMonitor cpuPct={device.cpuPct} ramPct={device.ramPct} tempC={device.tempC} latencyMs={device.latencyMs} />;
}

function RealMonitor({ connection }: { connection: NonNullable<ReturnType<typeof useDeviceConnection>>; host: string }) {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const memHistory = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const snap = await getSnapshot(connection);
        if (cancelled) return;
        setSnapshot(snap);
        setError(null);
        const pct = snap.mem_total_mb > 0 ? Math.round((snap.mem_used_mb / snap.mem_total_mb) * 100) : 0;
        memHistory.current = [...memHistory.current.slice(-29), pct];
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connection]);

  const memPct = snapshot && snapshot.mem_total_mb > 0 ? Math.round((snapshot.mem_used_mb / snapshot.mem_total_mb) * 100) : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      {error && (
        <div className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 text-[12px] text-status-error">
          {error}
        </div>
      )}
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Load (1m)" value={snapshot?.load_1m.toFixed(2) ?? "—"} icon={<Cpu size={14} />} />
        <StatTile label="RAM" value={memPct ?? "—"} unit="%" icon={<MemoryStick size={14} />} />
        <StatTile
          label="Temp"
          value={snapshot?.temp_c?.toFixed(1) ?? "—"}
          unit="°C"
          tone={snapshot?.temp_c && snapshot.temp_c > 65 ? "warning" : "neutral"}
          icon={<Thermometer size={14} />}
        />
        <StatTile label="Uptime" value={snapshot ? formatUptime(snapshot.uptime_seconds) : "—"} icon={<Clock size={14} />} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Disk (/)" subtitle={snapshot ? `${snapshot.disk_used} used of ${snapshot.disk_total}` : undefined} action={<HardDrive size={14} className="text-text-tertiary" />} />
          <div className="p-3">
            <div className="h-2 overflow-hidden rounded-full bg-bg-surface-2">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${snapshot?.disk_used_pct ?? 0}%` }}
              />
            </div>
            <div className="mt-1.5 text-right text-[11px] text-text-tertiary">{snapshot?.disk_used_pct ?? 0}% used</div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="RAM"
            subtitle="Live — polled every 8s over SSH"
            action={<RefreshCw size={13} className="text-text-tertiary" />}
          />
          <div className="p-3">
            <Sparkline data={memHistory.current.length ? memHistory.current : [0]} width={280} height={70} className="w-full" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Raw probe output" subtitle="uptime / free -m / df -h / temp — via a single SSH exec" />
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap bg-[#0a0c11] p-3 font-mono text-[11px] text-[#c9d1d9]">
          {snapshot?.raw ?? (error ? "" : "Fetching…")}
        </pre>
      </Card>
    </div>
  );
}

function MockMonitor({
  cpuPct,
  ramPct,
  tempC,
  latencyMs,
}: {
  cpuPct?: number;
  ramPct?: number;
  tempC?: number;
  latencyMs?: number;
}) {
  const ramSeries = fakeSeries(ramPct ?? 40, 12);
  const netSeries = fakeSeries(30, 40);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="CPU" value={cpuPct ?? "—"} unit="%" icon={<Cpu size={14} />} />
        <StatTile label="RAM" value={ramPct ?? "—"} unit="%" icon={<MemoryStick size={14} />} />
        <StatTile
          label="Temp"
          value={tempC ?? "—"}
          unit="°C"
          tone={tempC && tempC > 65 ? "warning" : "neutral"}
          icon={<Thermometer size={14} />}
        />
        <StatTile label="Disk free" value="18.4" unit="GB / 32GB" icon={<HardDrive size={14} />} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="CPU per-core" subtitle="4 cores" />
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3].map((core) => {
              const pct = Math.max(4, Math.min(96, (cpuPct ?? 30) + (core - 1.5) * 12));
              return (
                <div key={core} className="flex items-center gap-2 text-[12px]">
                  <span className="w-12 text-text-tertiary">core {core}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-9 text-right font-mono text-[11px] text-text-tertiary">{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="RAM" subtitle="Last 60s" />
          <div className="p-3">
            <Sparkline data={ramSeries} width={280} height={70} className="w-full" />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Network" subtitle="eth0 · RX/TX" />
        <div className="p-3">
          <Sparkline data={netSeries} width={600} height={70} className="w-full" strokeClassName="stroke-status-online" />
        </div>
        <div className="flex gap-6 border-t border-border-subtle px-3 py-2 text-[12px] text-text-secondary">
          <span>RX: 1.2 MB/s</span>
          <span>TX: 340 KB/s</span>
          <span>Latency: {latencyMs ?? "—"}ms</span>
        </div>
      </Card>
    </div>
  );
}
