import { useState } from "react";
import { NavLink, Outlet, useParams, useNavigate, Navigate } from "react-router-dom";
import {
  TerminalSquare,
  FolderOpen,
  Activity,
  ListTree,
  ScrollText,
  Usb,
  Share2,
  Edit3,
  RefreshCw,
  Power,
  Trash2,
  Stethoscope,
  Loader2,
  X,
} from "lucide-react";
import { useAllDevices } from "../../lib/useAllDevices";
import { useRealDevicesStore } from "../../state/realDevices";
import { DEVICE_TYPE_ICON, DEVICE_TYPE_LABEL } from "../../lib/deviceMeta";
import { StatusDot, statusLabel } from "../ui/StatusDot";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { testConnection, execCommand } from "../../ipc/ssh";

const TABS = [
  { to: "", label: "Overview", icon: Activity, end: true },
  { to: "terminal", label: "Terminal", icon: TerminalSquare },
  { to: "files", label: "Files", icon: FolderOpen },
  { to: "monitor", label: "Monitor", icon: Activity },
  { to: "processes", label: "Processes & Services", icon: ListTree },
  { to: "logs", label: "Logs", icon: ScrollText },
  { to: "serial", label: "Serial", icon: Usb },
];

function RebootConfirmModal({
  alias,
  onClose,
  onConfirm,
}: {
  alias: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-status-error/40 bg-bg-overlay p-4 shadow-[var(--shadow-2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-status-error">Reboot {alias}?</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
        <p className="mb-3 text-[12px] text-text-secondary">
          This runs <code className="rounded bg-bg-surface-2 px-1">sudo reboot</code> over SSH. The device will
          drop offline until it comes back up. Type <strong>{alias}</strong> to confirm.
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-status-error"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" disabled={typed !== alias} onClick={onConfirm}>
            Reboot
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DeviceLayout() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const allDevices = useAllDevices();
  const device = allDevices.find((d) => d.id === deviceId);
  const realDevice = useRealDevicesStore((s) => s.devices.find((d) => d.id === deviceId));
  const updateDevice = useRealDevicesStore((s) => s.updateDevice);
  const setStatus = useRealDevicesStore((s) => s.setStatus);
  const removeDevice = useRealDevicesStore((s) => s.removeDevice);

  const [reconnecting, setReconnecting] = useState(false);
  const [showReboot, setShowReboot] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [aliasInput, setAliasInput] = useState(device?.alias ?? "");
  const [toast, setToast] = useState<string | null>(null);

  if (!device) return <Navigate to="/devices" replace />;

  const Icon = DEVICE_TYPE_ICON[device.deviceType];
  const isReal = !!realDevice;

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleReconnect() {
    if (!realDevice) return;
    setReconnecting(true);
    try {
      await testConnection(realDevice.connection);
      setStatus(realDevice.id, "online", "just now");
      showToast("Reconnected successfully");
    } catch (e) {
      setStatus(realDevice.id, "offline");
      showToast(`Reconnect failed: ${String(e)}`);
    } finally {
      setReconnecting(false);
    }
  }

  async function handleReboot() {
    if (!realDevice) return;
    setShowReboot(false);
    setRebooting(true);
    try {
      await execCommand(realDevice.connection, "sudo reboot");
      setStatus(realDevice.id, "offline");
      showToast("Reboot command sent");
    } catch (e) {
      showToast(`Reboot failed: ${String(e)}`);
    } finally {
      setRebooting(false);
    }
  }

  function handleSaveAlias() {
    if (realDevice && aliasInput.trim()) {
      updateDevice(realDevice.id, { alias: aliasInput.trim() });
    }
    setEditing(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-subtle bg-bg-surface px-4 py-3">
        {toast && (
          <div className="mb-2 rounded-md border border-border-default bg-bg-surface-2 px-2.5 py-1.5 text-[11px] text-text-primary">
            {toast}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-surface-2">
              <Icon size={18} className="text-text-secondary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {editing ? (
                  <input
                    autoFocus
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveAlias()}
                    onBlur={handleSaveAlias}
                    className="rounded border border-accent bg-bg-base px-1.5 py-0.5 text-[15px] font-semibold text-text-primary outline-none"
                  />
                ) : (
                  <h1 className="text-[15px] font-semibold text-text-primary">{device.alias}</h1>
                )}
                <StatusDot status={device.status} />
                <span className="text-[11px] text-text-tertiary">{statusLabel(device.status)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-text-tertiary">
                <span>{device.ip}</span>
                <span>·</span>
                <span>{device.hostname}</span>
                {device.latencyMs != null && (
                  <>
                    <span>·</span>
                    <span>{device.latencyMs}ms</span>
                  </>
                )}
                <span>·</span>
                <span>{DEVICE_TYPE_LABEL[device.deviceType]}</span>
                <span>·</span>
                <span>seen {device.lastSeen}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" icon={<Share2 size={13} />} onClick={() => navigate("/shares")}>
              Share
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Stethoscope size={13} />}
              disabled={!isReal}
              title={isReal ? "Open Monitor for live diagnostics" : "Demo device — no real diagnostics"}
              onClick={() => navigate(`/devices/${device.id}/monitor`)}
            >
              Diagnostics
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Edit3 size={13} />}
              disabled={!isReal}
              title={isReal ? "Rename this device" : "Demo device — editing disabled"}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={reconnecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              disabled={!isReal || reconnecting}
              title={isReal ? "Re-test the SSH connection" : "Demo device — nothing to reconnect to"}
              onClick={handleReconnect}
            >
              Reconnect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={rebooting ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
              disabled={!isReal || rebooting}
              title={isReal ? "Reboot over SSH (sudo reboot)" : "Demo device — no real device to reboot"}
              onClick={() => setShowReboot(true)}
            >
              Reboot
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={13} />}
              disabled={!isReal}
              title={isReal ? "Remove this device from NodeDeck" : "Demo device — cannot be removed"}
              onClick={() => {
                if (realDevice) {
                  removeDevice(realDevice.id);
                  navigate("/devices");
                }
              }}
            >
              Remove
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                )
              }
            >
              <tab.icon size={13} />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet context={{ device, connection: realDevice?.connection }} />
      </div>

      {showReboot && (
        <RebootConfirmModal alias={device.alias} onClose={() => setShowReboot(false)} onConfirm={handleReboot} />
      )}
    </div>
  );
}
