import { useEffect, useRef, useState } from "react";
import { Pause, Play, Trash2, RefreshCw } from "lucide-react";
import { logs as mockLogs } from "../../mocks/data";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/cn";
import { useDeviceConnection } from "../../lib/useDevice";
import { execCommand } from "../../ipc/ssh";

const LEVEL_COLOR: Record<string, string> = {
  info: "text-text-secondary",
  warn: "text-status-warning",
  error: "text-status-error",
  debug: "text-text-tertiary",
};

export function LogsScreen() {
  const connection = useDeviceConnection();
  const [live, setLive] = useState(true);
  const [source, setSource] = useState("all");
  const [realLines, setRealLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!connection || !live) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await execCommand(connection!, "journalctl -n 80 --no-pager -o short 2>&1 || dmesg 2>&1 | tail -80");
        if (!cancelled) {
          setRealLines(res.stdout.trim().split("\n"));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connection, live]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [realLines]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-surface px-3 py-2">
        {!connection && (
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-border-default bg-bg-base px-2 py-1 text-[12px] text-text-primary outline-none"
          >
            <option value="all">All units</option>
            <option value="mavproxy">mavproxy</option>
            <option value="vision-node">vision-node</option>
            <option value="telemetry-relay">telemetry-relay</option>
          </select>
        )}
        {connection && <Badge variant="accent">live via SSH — journalctl</Badge>}
        <Button size="sm" variant={live ? "primary" : "secondary"} icon={live ? <Pause size={12} /> : <Play size={12} />} onClick={() => setLive((v) => !v)}>
          {live ? "Live" : "Paused"}
        </Button>
        {connection && (
          <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={() => setLive(true)}>
            Refresh
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => setRealLines([])}>
          Clear
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[#0a0c11] p-3 font-mono text-[12px] leading-relaxed">
        {error && <div className="mb-2 text-status-error">{error}</div>}
        {connection
          ? realLines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap text-[#c9d1d9]">
                {line}
              </div>
            ))
          : mockLogs
              .filter((l) => source === "all" || l.unit === source)
              .map((l, i) => (
                <div key={i} className="flex gap-2 whitespace-pre-wrap">
                  <span className="text-text-disabled">{l.ts}</span>
                  <span className={cn("w-12 shrink-0 uppercase", LEVEL_COLOR[l.level])}>{l.level}</span>
                  <span className="text-accent">{l.unit}</span>
                  <span className="text-[#c9d1d9]">{l.message}</span>
                </div>
              ))}
        {live && <span className="inline-block h-[13px] w-[6px] animate-pulse bg-[#c9d1d9] align-middle" />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
