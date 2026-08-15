import { useEffect, useState } from "react";
import { Plus, Copy, Ban, Lock, Loader2, X } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { EmptyState } from "../../components/ui/EmptyState";
import * as sharing from "../../ipc/sharing";
import type { ShareRecord } from "../../ipc/sharing";

const EXPIRY_OPTIONS = [
  { label: "Never", value: "" },
  { label: "1 hour", value: String(60 * 60) },
  { label: "24 hours", value: String(60 * 60 * 24) },
  { label: "7 days", value: String(60 * 60 * 24 * 7) },
];

function CreateShareModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [sourcePath, setSourcePath] = useState("");
  const [password, setPassword] = useState("");
  const [expiresInSecs, setExpiresInSecs] = useState("");
  const [downloadLimit, setDownloadLimit] = useState("");
  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
  const [error, setError] = useState("");

  async function handleCreate() {
    setStatus("creating");
    setError("");
    try {
      await sharing.createShare({
        sourcePath,
        password: password || undefined,
        expiresInSecs: expiresInSecs ? Number(expiresInSecs) : undefined,
        downloadLimit: downloadLimit ? Number(downloadLimit) : undefined,
      });
      onCreated();
      onClose();
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-border-default bg-bg-overlay p-4 shadow-[var(--shadow-2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text-primary">Create share</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Local file path</span>
            <input
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder="/Users/you/Documents/flight_log.bin"
              className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Password (optional)</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for no password" />
          </label>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Expires</span>
              <select
                value={expiresInSecs}
                onChange={(e) => setExpiresInSecs(e.target.value)}
                className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-28">
              <span className="mb-1 block text-[11px] font-medium text-text-tertiary">Download limit</span>
              <input
                type="number"
                min={1}
                value={downloadLimit}
                onChange={(e) => setDownloadLimit(e.target.value)}
                placeholder="∞"
                className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent"
              />
            </label>
          </div>
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
            disabled={!sourcePath || status === "creating"}
            onClick={handleCreate}
            icon={status === "creating" ? <Loader2 size={13} className="animate-spin" /> : undefined}
          >
            {status === "creating" ? "Creating…" : "Create share"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SharesScreen() {
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  function refresh() {
    setLoading(true);
    sharing
      .listShares()
      .then(setShares)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    sharing.lanBaseUrl().then(setBaseUrl);
  }, []);

  const now = Date.now() / 1000;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[14px] font-semibold">Public shares</h1>
        <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setShowCreate(true)}>
          Create share
        </Button>
      </div>

      <div className="rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-[11px] text-status-warning">
        Links are reachable by any device on your local network (LAN) right now, streamed directly from
        the source file. Access from <em>outside</em> your LAN needs a tunnel/relay service, which isn't
        set up yet — that's an infrastructure/cost decision, not just code (see spec section 7).
      </div>

      <Card>
        <CardHeader
          title="Active links"
          subtitle="Files stream direct from source — never copied elsewhere"
        />
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-text-tertiary">
            <Loader2 size={13} className="animate-spin" /> Loading…
          </div>
        ) : shares.length === 0 ? (
          <EmptyState title="No shares yet" detail='Click "Create share" and point it at a local file.' />
        ) : (
          <div className="divide-y divide-border-subtle">
            {shares.map((s) => {
              const expired = s.expires_at != null && now > s.expires_at;
              const limitReached = s.download_limit != null && s.download_count >= s.download_limit;
              const url = baseUrl ? `${baseUrl}/s/${s.token}` : null;
              return (
                <div key={s.id} className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{s.file_name}</span>
                    {s.password_protected && <Lock size={12} className="text-text-tertiary" />}
                    {s.revoked ? (
                      <Badge variant="error">revoked</Badge>
                    ) : expired ? (
                      <Badge variant="error">expired</Badge>
                    ) : limitReached ? (
                      <Badge variant="warning">limit reached</Badge>
                    ) : (
                      <Badge variant="success">active</Badge>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-bg-surface-2 px-2 py-1 font-mono text-[11px] text-text-secondary">
                      {url ?? "resolving LAN address…"}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Copy size={12} />}
                      disabled={!url}
                      onClick={() => url && navigator.clipboard.writeText(url)}
                    />
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Ban size={12} />}
                      disabled={s.revoked}
                      onClick={() => sharing.revokeShare(s.id).then(refresh)}
                    >
                      Revoke
                    </Button>
                  </div>
                  <div className="mt-2 flex gap-4 text-[11px] text-text-tertiary">
                    <span>
                      {s.download_count} downloads{s.download_limit ? ` / ${s.download_limit} limit` : ""}
                    </span>
                    {s.expires_at && <span>expires {new Date(s.expires_at * 1000).toLocaleString()}</span>}
                    <span>created {new Date(s.created_at * 1000).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showCreate && (
        <CreateShareModal onClose={() => setShowCreate(false)} onCreated={refresh} />
      )}
    </div>
  );
}
