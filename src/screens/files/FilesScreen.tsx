import { useEffect, useRef, useState } from "react";
import { Folder, File as FileIcon, ChevronRight, Home, Upload, Download, Loader2, X } from "lucide-react";
import { useDevice, useDeviceConnection } from "../../lib/useDevice";
import { Button } from "../../components/ui/Button";
import { listDir as sftpListDir, uploadFile, downloadFile, onTransferProgress } from "../../ipc/sftp";
import * as localfs from "../../ipc/localfs";
import type { SftpEntry } from "../../ipc/types";

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

interface Row {
  name: string;
  type: "dir" | "file";
  size: string;
}

interface Transfer {
  id: string;
  name: string;
  dir: "up" | "down";
  sent: number;
  total: number;
  status: "running" | "done" | "error";
  error?: string;
}

function Pane({
  title,
  path,
  rows,
  loading,
  error,
  selected,
  onSelect,
  onEnterDir,
}: {
  title: string;
  path: string;
  rows: Row[];
  loading?: boolean;
  error?: string | null;
  selected: string | null;
  onSelect: (name: string, type: "dir" | "file") => void;
  onEnterDir?: (name: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-surface px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{title}</span>
        <div className="ml-auto flex items-center gap-1 font-mono text-[11px] text-text-tertiary truncate">
          <Home size={12} className="shrink-0" />
          <ChevronRight size={11} className="shrink-0" />
          <span className="truncate">{path}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-text-tertiary">
            <Loader2 size={13} className="animate-spin" /> Listing directory…
          </div>
        )}
        {error && <div className="px-3 py-3 text-[12px] text-status-error">{error}</div>}
        {!loading &&
          !error &&
          rows.map((r) => (
            <div
              key={r.name}
              onClick={() => onSelect(r.name, r.type)}
              onDoubleClick={() => r.type === "dir" && onEnterDir?.(r.name)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-bg-hover ${
                selected === r.name ? "bg-accent-soft" : ""
              }`}
            >
              {r.type === "dir" ? (
                <Folder size={14} className="text-accent" />
              ) : (
                <FileIcon size={14} className="text-text-tertiary" />
              )}
              <span className="flex-1 truncate text-text-primary">{r.name}</span>
              <span className="font-mono text-[11px] text-text-tertiary">{r.size}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export function FilesScreen() {
  const device = useDevice();
  const connection = useDeviceConnection();

  const [localPath, setLocalPath] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState<localfs.LocalEntry[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedLocal, setSelectedLocal] = useState<{ name: string; type: "dir" | "file" } | null>(null);

  const [remotePath, setRemotePath] = useState(".");
  const [remoteEntries, setRemoteEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<{ name: string; type: "dir" | "file" } | null>(null);

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const transfersRef = useRef(transfers);
  transfersRef.current = transfers;

  function reloadRemote() {
    if (!connection) return;
    setLoading(true);
    sftpListDir(connection, remotePath)
      .then(setRemoteEntries)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  function reloadLocal() {
    if (localPath === null) return;
    setLocalLoading(true);
    localfs
      .listDir(localPath)
      .then(setLocalEntries)
      .catch((e) => setLocalError(String(e)))
      .finally(() => setLocalLoading(false));
  }

  useEffect(() => {
    localfs.homeDir().then((h) => setLocalPath(h ?? ".")).catch(() => setLocalPath("."));
  }, []);

  useEffect(() => {
    if (localPath === null) return;
    let cancelled = false;
    setLocalLoading(true);
    setLocalError(null);
    setSelectedLocal(null);
    localfs
      .listDir(localPath)
      .then((entries) => !cancelled && setLocalEntries(entries))
      .catch((e) => !cancelled && setLocalError(String(e)))
      .finally(() => !cancelled && setLocalLoading(false));
    return () => {
      cancelled = true;
    };
  }, [localPath]);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedRemote(null);
    sftpListDir(connection, remotePath)
      .then((entries) => {
        if (!cancelled) setRemoteEntries(entries);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connection, remotePath]);

  useEffect(() => {
    const unlisten = onTransferProgress((id, sent, total) => {
      setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, sent, total } : t)));
    });
    return () => {
      unlisten.then((u) => u());
    };
  }, []);

  async function handleUpload() {
    if (!connection || !selectedLocal || selectedLocal.type !== "file" || localPath === null) return;
    const id = crypto.randomUUID();
    const localFull = `${localPath}/${selectedLocal.name}`;
    const remoteFull = remotePath === "." ? selectedLocal.name : `${remotePath}/${selectedLocal.name}`;
    setTransfers((prev) => [{ id, name: selectedLocal.name, dir: "up", sent: 0, total: 0, status: "running" }, ...prev]);
    try {
      await uploadFile(connection, localFull, remoteFull, id);
      setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
      reloadRemote();
    } catch (e) {
      setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: "error", error: String(e) } : t)));
    }
  }

  async function handleDownload() {
    if (!connection || !selectedRemote || selectedRemote.type !== "file" || localPath === null) return;
    const id = crypto.randomUUID();
    const remoteFull = remotePath === "." ? selectedRemote.name : `${remotePath}/${selectedRemote.name}`;
    const localFull = `${localPath}/${selectedRemote.name}`;
    setTransfers((prev) => [{ id, name: selectedRemote.name, dir: "down", sent: 0, total: 0, status: "running" }, ...prev]);
    try {
      await downloadFile(connection, remoteFull, localFull, id);
      setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
      reloadLocal();
    } catch (e) {
      setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: "error", error: String(e) } : t)));
    }
  }

  const localRows: Row[] = localEntries.map((e) => ({
    name: e.name,
    type: e.is_dir ? "dir" : "file",
    size: e.is_dir ? "—" : formatBytes(e.size),
  }));

  const remoteRows: Row[] = connection
    ? remoteEntries
        .filter((e) => e.name !== "." && e.name !== "..")
        .map((e) => ({ name: e.name, type: e.is_dir ? ("dir" as const) : ("file" as const), size: e.is_dir ? "—" : formatBytes(e.size) }))
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-[3]">
        <div className="flex min-h-0 flex-1 flex-col border-r border-border-subtle">
          <Pane
            title="Local"
            path={localPath ?? "…"}
            rows={localRows}
            loading={localLoading}
            error={localError}
            selected={selectedLocal?.name ?? null}
            onSelect={(name, type) => setSelectedLocal({ name, type })}
            onEnterDir={(name) => setLocalPath((p) => `${p}/${name}`)}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {connection ? (
            <Pane
              title={device.alias}
              path={remotePath}
              rows={remoteRows}
              loading={loading}
              error={error}
              selected={selectedRemote?.name ?? null}
              onSelect={(name, type) => setSelectedRemote({ name, type })}
              onEnterDir={(name) => setRemotePath((p) => (p === "." ? name : `${p}/${name}`))}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-text-tertiary">
              Connect this device with real SSH credentials to browse its files.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto border-t border-border-subtle bg-bg-surface p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Transfer queue
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              icon={<Upload size={12} />}
              disabled={!connection || selectedLocal?.type !== "file"}
              title={selectedLocal?.type !== "file" ? "Select a local file first" : `Upload ${selectedLocal.name}`}
              onClick={handleUpload}
            >
              Upload{selectedLocal?.type === "file" ? ` "${selectedLocal.name}"` : ""}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Download size={12} />}
              disabled={!connection || selectedRemote?.type !== "file"}
              title={selectedRemote?.type !== "file" ? "Select a remote file first" : `Download ${selectedRemote.name}`}
              onClick={handleDownload}
            >
              Download{selectedRemote?.type === "file" ? ` "${selectedRemote.name}"` : ""}
            </Button>
          </div>
        </div>
        {transfers.length === 0 ? (
          <div className="text-[11px] text-text-tertiary">
            Click a file in either pane to select it, then Upload or Download. No drag-and-drop yet — see
            TASKS.md.
          </div>
        ) : (
          <div className="space-y-1.5">
            {transfers.map((t) => (
              <TransferRow key={t.id} transfer={t} onDismiss={() => setTransfers((prev) => prev.filter((x) => x.id !== t.id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransferRow({ transfer, onDismiss }: { transfer: Transfer; onDismiss: () => void }) {
  const pct = transfer.total > 0 ? Math.round((transfer.sent / transfer.total) * 100) : transfer.status === "done" ? 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      {transfer.dir === "up" ? (
        <Upload size={12} className="text-accent shrink-0" />
      ) : (
        <Download size={12} className="text-status-online shrink-0" />
      )}
      <span className="w-40 shrink-0 truncate text-text-primary">{transfer.name}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-surface-2">
        <div
          className={`h-full rounded-full ${transfer.status === "error" ? "bg-status-error" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[11px] text-text-tertiary">
        {transfer.status === "error" ? "err" : `${pct}%`}
      </span>
      {transfer.status !== "running" && (
        <button onClick={onDismiss} className="shrink-0 text-text-tertiary hover:text-text-primary">
          <X size={12} />
        </button>
      )}
      {transfer.status === "error" && (
        <span className="w-40 shrink-0 truncate text-[11px] text-status-error" title={transfer.error}>
          {transfer.error}
        </span>
      )}
    </div>
  );
}
