import { useEffect, useMemo, useState } from "react";
import { Radar, Play, Server } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { AddDeviceModal } from "../../components/devices/AddDeviceModal";
import * as discovery from "../../ipc/discovery";
import { useNetworkScannerStore } from "../../state/networkScanner";
import { useAllDevices } from "../../lib/useAllDevices";
import { Link } from "react-router-dom";

export function NetworkScannerScreen() {
  const cidr = useNetworkScannerStore((s) => s.cidr);
  const setCidr = useNetworkScannerStore((s) => s.setCidr);
  const results = useNetworkScannerStore((s) => s.results);
  const setResults = useNetworkScannerStore((s) => s.setResults);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectHost, setConnectHost] = useState<string | null>(null);

  const knownDevices = useAllDevices();
  const knownByIp = useMemo(() => {
    const map = new Map<string, (typeof knownDevices)[number]>();
    for (const d of knownDevices) map.set(d.ip, d);
    return map;
  }, [knownDevices]);

  useEffect(() => {
    if (!cidr) {
      discovery.getDefaultCidr().then((c) => c && setCidr(c)).catch(() => {});
    }
  }, [cidr, setCidr]);

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const found = await discovery.scan(cidr);
      setResults(found);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Card>
        <div className="flex items-center gap-3 p-3">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium text-text-tertiary">CIDR range</label>
            <input
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder="10.104.17.0/24"
              className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary outline-none focus:border-accent"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={scanning ? <Radar size={13} className="animate-spin" /> : <Play size={13} />}
            onClick={runScan}
            disabled={scanning || !cidr}
          >
            {scanning ? "Scanning…" : "Scan LAN"}
          </Button>
        </div>
        <div className="border-t border-border-subtle px-3 py-2 text-[11px] text-text-tertiary">
          Probes every host across the range (max /22) and only lists ones with a real ARP reply — a genuine
          device on the LAN, not just a network accepting the connection on a host's behalf. SSH-open ones
          are what this app can actually manage. No mDNS/full-port scan yet — see TASKS.md Stage 2.
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Discovered devices"
          subtitle={
            scanning
              ? `Scanning ${cidr}…`
              : results
                ? `${results.length} device(s) found`
                : "Run a scan to discover devices"
          }
        />
        {error && <div className="px-3 py-3 text-[12px] text-status-error">{error}</div>}
        {!error && results !== null && results.length === 0 && (
          <EmptyState icon={<Server size={18} />} title="No devices responded" />
        )}
        {!error && results === null && !scanning && (
          <EmptyState icon={<Radar size={18} />} title="No scan run yet" detail={`Click "Scan LAN" to probe ${cidr || "your network"}.`} />
        )}
        {results && results.length > 0 && (
          <div className="divide-y divide-border-subtle">
            {results.map((d) => {
              const known = knownByIp.get(d.ip);
              return (
                <div key={d.ip} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                  <Server size={15} className="text-status-online" />
                  <div className="w-48">
                    {known ? (
                      <Link to={`/devices/${known.id}`} className="block truncate font-medium text-accent hover:underline">
                        {known.alias}
                      </Link>
                    ) : (
                      <span className="block truncate text-text-tertiary">unnamed</span>
                    )}
                    <span className="block truncate font-mono text-[11px] text-text-tertiary">{d.ip}</span>
                  </div>
                  <span className="w-40 font-mono text-[11px] text-text-tertiary">{d.mac ?? "MAC unknown"}</span>
                  <span className="w-40 truncate text-[11px] text-text-tertiary">{d.vendor ?? "Unknown vendor"}</span>
                  <span className="w-16 text-[11px] text-text-tertiary">{d.latency_ms}ms</span>
                  {d.ssh_open ? <Badge variant="accent">SSH open</Badge> : <Badge>no SSH</Badge>}
                  {known ? (
                    <Badge variant="accent" className="ml-auto">
                      saved
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ml-auto"
                      disabled={!d.ssh_open}
                      title={d.ssh_open ? undefined : "No SSH server detected on port 22 — this app manages devices over SSH"}
                      onClick={() => setConnectHost(d.ip)}
                    >
                      Save & connect
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {connectHost && <AddDeviceModal initialHost={connectHost} onClose={() => setConnectHost(null)} />}
    </div>
  );
}
