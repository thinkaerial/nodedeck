import { useEffect, useState } from "react";
import { KeyRound, ShieldAlert, ShieldCheck, Users, ScrollText, Pencil, Loader2, Check, X, Fingerprint } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { EmptyState } from "../../components/ui/EmptyState";
import { useRealDevicesStore, type RealDevice } from "../../state/realDevices";
import { testConnection } from "../../ipc/ssh";
import { getKnownHostKey, forgetKnownHostKey } from "../../ipc/knownHosts";
import { listAuditLog } from "../../ipc/groups";
import type { DbAuditEntry } from "../../ipc/groups";

const ROLES = [
  { name: "Admin", desc: "Full access, including destructive fleet tasks and vault management" },
  { name: "Engineer", desc: "Connect, monitor, run non-destructive tasks" },
  { name: "Operator", desc: "Connect and monitor only" },
  { name: "Viewer", desc: "Read-only dashboard access" },
];

function CredentialRow({ device }: { device: RealDevice }) {
  const updateDevice = useRealDevicesStore((s) => s.updateDevice);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(device.connection.username);
  const [password, setPassword] = useState(device.connection.password);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSave() {
    setStatus("saving");
    setError("");
    const newConnection = { ...device.connection, username, password };
    try {
      await testConnection(newConnection);
      updateDevice(device.id, { connection: newConnection, status: "online", lastSeen: "just now" });
      setStatus("idle");
      setEditing(false);
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }

  function handleCancel() {
    setUsername(device.connection.username);
    setPassword(device.connection.password);
    setError("");
    setStatus("idle");
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
        <KeyRound size={14} className="text-text-tertiary" />
        <span className="flex-1 text-text-primary">
          {device.connection.username}@{device.connection.host}:{device.connection.port}
        </span>
        <Badge>password (local storage)</Badge>
        <Button size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 text-[13px]">
      <div className="mb-1 font-mono text-[11px] text-text-tertiary">
        {device.connection.host}:{device.connection.port}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="flex-1 rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent"
        />
        <PasswordInput className="flex-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" />
        <Button size="sm" variant="primary" icon={status === "saving" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} disabled={status === "saving"} onClick={handleSave}>
          Save & test
        </Button>
        <Button size="sm" variant="ghost" icon={<X size={12} />} onClick={handleCancel}>
          Cancel
        </Button>
      </div>
      {status === "error" && <div className="mt-1.5 text-[11px] text-status-error">{error}</div>}
    </div>
  );
}

function HostKeyRow({ device }: { device: RealDevice }) {
  const [fingerprint, setFingerprint] = useState<string | null | "loading">("loading");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getKnownHostKey(device.connection.host, device.connection.port)
      .then(setFingerprint)
      .catch(() => setFingerprint(null));
  }, [device.connection.host, device.connection.port]);

  async function handleForget() {
    setBusy(true);
    try {
      await forgetKnownHostKey(device.connection.host, device.connection.port);
      setFingerprint(null);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
      <Fingerprint size={14} className="text-text-tertiary" />
      <span className="w-40 truncate text-text-primary">{device.alias}</span>
      <span className="flex-1 truncate font-mono text-[11px] text-text-tertiary">
        {fingerprint === "loading" ? "…" : fingerprint ?? "not yet connected"}
      </span>
      {fingerprint && fingerprint !== "loading" && !confirming && (
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          Forget key
        </Button>
      )}
      {confirming && (
        <>
          <span className="text-[11px] text-status-error">Only do this if you know why the key changed —</span>
          <Button size="sm" variant="danger" disabled={busy} onClick={handleForget}>
            Confirm forget
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}

function formatAuditTime(at: number) {
  return new Date(at * 1000).toLocaleString();
}

export function CredentialsSecurityScreen() {
  const realDevices = useRealDevicesStore((s) => s.devices);
  const [auditLog, setAuditLog] = useState<DbAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  useEffect(() => {
    listAuditLog()
      .then(setAuditLog)
      .finally(() => setAuditLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-[11px] text-status-warning flex items-center gap-2">
        <ShieldAlert size={14} className="shrink-0" />
        Device passwords are saved in this app's own local storage, not the OS keychain — not every
        user has Keychain/Credential Manager set up reliably, so the app manages its own storage
        instead. An OS-keychain-backed vault exists in the code (`core/vault.rs`) but isn't wired in.
      </div>

      <div className="rounded-md border border-status-online/30 bg-status-online/10 px-3 py-2 text-[11px] text-status-online flex items-center gap-2">
        <ShieldCheck size={14} className="shrink-0" />
        SSH host-key verification is on. The first connection to a device trusts and saves its key
        fingerprint; if that key ever changes afterward (device reimaged — or a network attack),
        the connection is blocked until you review it below.
      </div>

      <Card>
        <CardHeader title="Devices with saved credentials" subtitle="Stored in this app's local storage. Edit updates and re-tests the connection." />
        {realDevices.length === 0 ? (
          <EmptyState icon={<KeyRound size={18} />} title="No devices connected yet" />
        ) : (
          <div className="divide-y divide-border-subtle">
            {realDevices.map((d) => (
              <CredentialRow key={d.id} device={d} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Trusted SSH host keys" subtitle="One fingerprint per device, checked on every connection" />
        {realDevices.length === 0 ? (
          <EmptyState icon={<Fingerprint size={18} />} title="No devices connected yet" />
        ) : (
          <div className="divide-y divide-border-subtle">
            {realDevices.map((d) => (
              <HostKeyRow key={d.id} device={d} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Role model" subtitle="Defined for future team deployments — not enforced yet" action={<Users size={14} className="text-text-tertiary" />} />
        <div className="divide-y divide-border-subtle">
          {ROLES.map((r) => (
            <div key={r.name} className="px-3 py-2.5 text-[13px]">
              <span className="font-medium text-text-primary">{r.name}</span>
              <span className="ml-2 text-text-tertiary">{r.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Audit log" subtitle="Sensitive operations for this account" action={<ScrollText size={14} className="text-text-tertiary" />} />
        {auditLoading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-text-tertiary">
            <Loader2 size={13} className="animate-spin" /> Loading…
          </div>
        ) : auditLog.length === 0 ? (
          <EmptyState title="No sensitive operations recorded yet" />
        ) : (
          <div className="divide-y divide-border-subtle">
            {auditLog.map((a) => (
              <div key={a.id} className="px-3 py-2.5 text-[12px]">
                <span className="font-medium text-text-primary">{a.actor}</span>{" "}
                <span className="text-text-secondary">{a.action.replaceAll("_", " ")}</span>{" "}
                <span className="text-text-tertiary">
                  {a.target ? `— ${a.target} · ` : "— "}
                  {formatAuditTime(a.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
