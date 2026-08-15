import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Import, Download, Server, X, Loader2, Check } from "lucide-react";
import { useAllDevices } from "../../lib/useAllDevices";
import { useRealDevicesStore } from "../../state/realDevices";
import { useUIStore } from "../../state/store";
import { StatusDot, statusLabel } from "../../components/ui/StatusDot";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { DEVICE_TYPE_ICON, DEVICE_TYPE_LABEL } from "../../lib/deviceMeta";
import { AddDeviceModal } from "../../components/devices/AddDeviceModal";
import * as groupsApi from "../../ipc/groups";
import type { DbGroup } from "../../ipc/groups";

function ImportExportModal({ mode, onClose, onDone }: { mode: "import" | "export"; onClose: () => void; onDone: () => void }) {
  const [path, setPath] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setStatus("busy");
    setMessage("");
    try {
      if (mode === "import") {
        const count = await groupsApi.importDevices(path);
        setMessage(`Imported ${count} device(s).`);
      } else {
        await groupsApi.exportDevices(path);
        setMessage(`Exported to ${path}`);
      }
      onDone();
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setMessage(String(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-border-default bg-bg-overlay p-4 shadow-[var(--shadow-2)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text-primary">{mode === "import" ? "Import devices" : "Export devices"}</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
        <p className="mb-2 text-[11px] text-text-tertiary">
          {mode === "import"
            ? "Plain JSON — an array of device objects (same shape this app exports). Includes credentials in plaintext, so only import files from a source you trust."
            : "Writes plain JSON, including credentials in plaintext — keep the file secure."}
        </p>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/Users/you/nodedeck-devices.json"
          className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary outline-none focus:border-accent"
        />
        {message && (
          <div className={`mt-2 text-[11px] ${status === "error" ? "text-status-error" : "text-status-online"}`}>{message}</div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" size="sm" disabled={!path || status === "busy"} icon={status === "busy" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} onClick={run}>
            {mode === "import" ? "Import" : "Export"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DevicesScreen() {
  const devices = useAllDevices();
  const loadFromDb = useRealDevicesStore((s) => s.loadFromDb);
  const showDemoDevices = useUIStore((s) => s.showDemoDevices);
  const setShowDemoDevices = useUIStore((s) => s.setShowDemoDevices);
  const [activeGroup, setActiveGroup] = useState<string | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [importExportMode, setImportExportMode] = useState<"import" | "export" | null>(null);

  const [groups, setGroups] = useState<DbGroup[]>([]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  function refreshGroups() {
    groupsApi.listGroups().then(setGroups).catch(() => {});
  }

  useEffect(refreshGroups, []);

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    await groupsApi.createGroup(newGroupName.trim());
    setNewGroupName("");
    setAddingGroup(false);
    refreshGroups();
  }

  const filtered = devices.filter((d) => activeGroup === "all" || d.groupId === activeGroup);

  return (
    <div className="flex h-full">
      <aside className="w-52 shrink-0 border-r border-border-subtle p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Groups</span>
          <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => setAddingGroup(true)} />
        </div>
        {addingGroup && (
          <div className="mb-1.5 flex gap-1">
            <input
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              placeholder="Group name"
              className="w-full rounded-md border border-border-default bg-bg-base px-2 py-1 text-[12px] text-text-primary outline-none focus:border-accent"
            />
            <Button size="sm" variant="primary" onClick={handleCreateGroup}>
              Add
            </Button>
          </div>
        )}
        <button
          onClick={() => setActiveGroup("all")}
          className={`mb-0.5 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] ${
            activeGroup === "all" ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-bg-hover"
          }`}
        >
          All devices
          <span className="text-[11px] text-text-tertiary">{devices.length}</span>
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            className={`mb-0.5 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] ${
              activeGroup === g.id ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-bg-hover"
            }`}
          >
            <span className="truncate">{g.name}</span>
            <span className="text-[11px] text-text-tertiary">
              {devices.filter((d) => d.groupId === g.id).length}
            </span>
          </button>
        ))}
      </aside>

      <div className="flex-1 overflow-auto">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
          <h1 className="text-[14px] font-semibold">Devices</h1>
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" icon={<Import size={13} />} onClick={() => setImportExportMode("import")}>
              Import
            </Button>
            <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={() => setImportExportMode("export")}>
              Export
            </Button>
            <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={() => setShowAddModal(true)}>
              Add device
            </Button>
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center">
            <EmptyState
              icon={<Server size={18} />}
              title="No devices yet"
              detail={
                showDemoDevices
                  ? "No devices in this group."
                  : 'Click "Add device" to connect your first real device by IP, or preview the UI with demo devices.'
              }
            />
            {!showDemoDevices && (
              <Button size="sm" variant="ghost" onClick={() => setShowDemoDevices(true)} className="-mt-4">
                Show demo devices
              </Button>
            )}
          </div>
        )}
        {filtered.length > 0 && (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wide text-text-tertiary">
              <th className="px-4 py-2 font-medium">Device</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">IP / Host</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Tags</th>
              <th className="px-4 py-2 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const Icon = DEVICE_TYPE_ICON[d.deviceType];
              return (
                <tr key={d.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-hover">
                  <td className="px-4 py-2.5">
                    <Link to={`/devices/${d.id}`} className="flex items-center gap-2 font-medium text-text-primary">
                      <Icon size={14} className="text-text-tertiary" />
                      {d.alias}
                      {"isReal" in d && <Badge variant="accent">live</Badge>}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{DEVICE_TYPE_LABEL[d.deviceType]}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-text-secondary">{d.ip}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <StatusDot status={d.status} />
                      {statusLabel(d.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {d.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-tertiary">{d.lastSeen}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>

      {showAddModal && <AddDeviceModal onClose={() => setShowAddModal(false)} />}
      {importExportMode && (
        <ImportExportModal
          mode={importExportMode}
          onClose={() => setImportExportMode(null)}
          onDone={() => loadFromDb()}
        />
      )}
    </div>
  );
}
