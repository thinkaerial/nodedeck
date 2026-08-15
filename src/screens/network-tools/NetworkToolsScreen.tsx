import { useState } from "react";
import { Activity, Globe, Route, Radar, Wifi, Zap, Loader2 } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import * as nettools from "../../ipc/nettools";
import * as mdns from "../../ipc/mdns";
import * as wol from "../../ipc/wol";
import type { MdnsEntry } from "../../ipc/mdns";

const TOOLS = [
  { id: "ping", label: "Ping", icon: Activity },
  { id: "dns", label: "DNS lookup", icon: Globe },
  { id: "arp", label: "ARP table", icon: Route },
  { id: "port", label: "Port check", icon: Zap },
  { id: "trace", label: "Traceroute", icon: Route },
  { id: "mdns", label: "mDNS browser", icon: Radar },
  { id: "wol", label: "Wake-on-LAN", icon: Wifi },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

function GenericToolPanel({ toolId }: { toolId: Exclude<ToolId, "mdns" | "wol"> }) {
  const [target, setTarget] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const needsTarget = toolId !== "arp";

  async function run() {
    setLoading(true);
    setOutput(null);
    try {
      let result;
      if (toolId === "ping") result = await nettools.ping(target);
      else if (toolId === "dns") result = await nettools.dnsLookup(target);
      else if (toolId === "arp") result = await nettools.arpTable();
      else if (toolId === "port") {
        const [host, portStr] = target.split(":");
        result = await nettools.portCheck(host, Number(portStr) || 22);
      } else {
        result = await nettools.traceroute(target);
      }
      setOutput((result.stdout || "") + (result.stderr ? `\n${result.stderr}` : ""));
    } catch (e) {
      setOutput(`error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title={TOOLS.find((t) => t.id === toolId)!.label} subtitle="Runs locally on this Mac — not over SSH to a device" />
      <div className="space-y-3 p-3">
        {needsTarget && (
          <div className="flex gap-2">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={toolId === "port" ? "10.104.17.161:22" : "10.104.17.161 or hostname"}
              className="flex-1 rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary outline-none focus:border-accent"
            />
            <Button variant="primary" size="sm" onClick={run} disabled={!target || loading} icon={loading ? <Loader2 size={13} className="animate-spin" /> : undefined}>
              Run
            </Button>
          </div>
        )}
        {!needsTarget && (
          <Button variant="primary" size="sm" onClick={run} disabled={loading} icon={loading ? <Loader2 size={13} className="animate-spin" /> : undefined}>
            Run
          </Button>
        )}
        <div className="h-56 overflow-auto rounded-md bg-[#0a0c11] p-3 font-mono text-[12px] text-[#c9d1d9] whitespace-pre-wrap">
          {output ?? <span className="text-text-tertiary">Run to see output…</span>}
        </div>
      </div>
    </Card>
  );
}

function MdnsPanel() {
  const [entries, setEntries] = useState<MdnsEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setEntries(null);
    try {
      setEntries(await mdns.browse());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="mDNS browser" subtitle="Browses _ssh._tcp / _workstation._tcp / _device-info._tcp for 4s" />
      <div className="space-y-3 p-3">
        <Button variant="primary" size="sm" onClick={run} disabled={loading} icon={loading ? <Loader2 size={13} className="animate-spin" /> : <Radar size={13} />}>
          {loading ? "Browsing…" : "Browse"}
        </Button>
        <div className="min-h-[8rem] rounded-md bg-[#0a0c11] p-3 font-mono text-[12px] text-[#c9d1d9]">
          {entries === null && !loading && <span className="text-text-tertiary">Run to see results…</span>}
          {entries !== null && entries.length === 0 && (
            <span className="text-text-tertiary">
              No mDNS advertisements found. Not every device publishes _ssh._tcp by default (many minimal Linux images
              don't) — this doesn't mean the device is unreachable, just that it isn't advertising over mDNS.
            </span>
          )}
          {entries?.map((e) => (
            <div key={e.hostname}>
              {e.hostname} — {e.addresses.join(", ")}:{e.port} ({e.service_type})
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function WolPanel() {
  const [mac, setMac] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setStatus(null);
    try {
      await wol.sendMagicPacket(mac);
      setStatus("Magic packet sent. The device must have Wake-on-LAN enabled to respond — this only sends the packet.");
    } catch (e) {
      setStatus(`error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Wake-on-LAN" subtitle="Broadcasts a magic packet on the local network" />
      <div className="space-y-3 p-3">
        <div className="flex gap-2">
          <input
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            placeholder="b8:27:eb:d3:63:a1"
            className="flex-1 rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary outline-none focus:border-accent"
          />
          <Button variant="primary" size="sm" onClick={run} disabled={!mac || loading} icon={loading ? <Loader2 size={13} className="animate-spin" /> : undefined}>
            Send
          </Button>
        </div>
        {status && <div className="text-[12px] text-text-secondary">{status}</div>}
      </div>
    </Card>
  );
}

export function NetworkToolsScreen() {
  const [active, setActive] = useState<ToolId>("ping");

  return (
    <div className="flex h-full">
      <aside className="w-48 shrink-0 border-r border-border-subtle p-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
              active === t.id ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-bg-hover",
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </aside>

      <div className="mx-auto max-w-2xl flex-1 p-4">
        {active === "mdns" ? <MdnsPanel /> : active === "wol" ? <WolPanel /> : <GenericToolPanel toolId={active} />}
      </div>
    </div>
  );
}
