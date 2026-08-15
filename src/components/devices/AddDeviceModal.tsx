import { useState, type ReactNode } from "react";
import { Loader2, ServerCog } from "lucide-react";
import { Button } from "../ui/Button";
import { PasswordInput } from "../ui/PasswordInput";
import { testConnection } from "../../ipc/ssh";
import { useRealDevicesStore, type RealDevice } from "../../state/realDevices";
import { cn } from "../../lib/cn";

export function AddDeviceModal({ onClose, initialHost }: { onClose: () => void; initialHost?: string }) {
  const addDevice = useRealDevicesStore((s) => s.addDevice);
  const [alias, setAlias] = useState("");
  const [host, setHost] = useState(initialHost ?? "");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "key">("password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("~/.ssh/id_ed25519");
  const [keyPassphrase, setKeyPassphrase] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState("");

  async function handleConnect() {
    setStatus("connecting");
    setError("");
    try {
      const connection =
        authMethod === "key"
          ? { host, port, username, password: "", private_key_path: keyPath, private_key_passphrase: keyPassphrase || null }
          : { host, port, username, password };

      const result = await testConnection(connection);
      const hostname = result.output.split("\n")[1]?.trim() || host;
      const id = `real-${host}`;
      const device: RealDevice = {
        id,
        alias: alias || hostname,
        deviceType: "raspberry_pi",
        status: "online",
        ip: host,
        hostname,
        groupId: "grp-real",
        tags: [],
        lastSeen: "just now",
        sshPort: port,
        isReal: true,
        connection,
      };
      addDevice(device);
      onClose();
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }

  const canSubmit = host && username && (authMethod === "password" ? true : keyPath) && status !== "connecting";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-border-default bg-bg-overlay p-4 shadow-[var(--shadow-2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <ServerCog size={16} className="text-accent" />
          <h2 className="text-[13px] font-semibold text-text-primary">Add device — SSH connect</h2>
        </div>

        <div className="space-y-2.5">
          <Field label="Alias (optional)">
            <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="drone-01-pi5" className={inputCls} />
          </Field>
          <div className="flex gap-2">
            <Field label="Host / IP" className="flex-1">
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="10.104.17.161" className={inputCls} />
            </Field>
            <Field label="Port" className="w-20">
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="pi" className={inputCls} />
          </Field>

          <div className="flex gap-1 rounded-md bg-bg-surface-2 p-0.5">
            {(["password", "key"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAuthMethod(m)}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-[12px] font-medium capitalize transition-colors",
                  authMethod === m ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary",
                )}
              >
                {m === "password" ? "Password" : "SSH key"}
              </button>
            ))}
          </div>

          {authMethod === "password" ? (
            <Field label="Password">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label="Private key path">
                <input
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  placeholder="~/.ssh/id_ed25519"
                  className={cn(inputCls, "font-mono")}
                />
              </Field>
              <Field label="Key passphrase (optional)">
                <PasswordInput value={keyPassphrase} onChange={(e) => setKeyPassphrase(e.target.value)} placeholder="Leave blank if none" />
              </Field>
            </>
          )}
        </div>

        {status === "error" && (
          <div className="mt-2 rounded-md border border-status-error/30 bg-status-error/10 px-2.5 py-1.5 text-[11px] text-status-error">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSubmit}
            onClick={handleConnect}
            icon={status === "connecting" ? <Loader2 size={13} className="animate-spin" /> : undefined}
          >
            {status === "connecting" ? "Connecting…" : "Test & save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent";

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[11px] font-medium text-text-tertiary">{label}</span>
      {children}
    </label>
  );
}
