import type { DeviceStatus } from "../../mocks/types";
import { cn } from "../../lib/cn";

const STATUS_COLOR: Record<DeviceStatus, string> = {
  online: "bg-status-online",
  offline: "bg-status-offline",
  warning: "bg-status-warning",
  connecting: "bg-status-connecting",
};

const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  warning: "Warning",
  connecting: "Connecting",
};

export function StatusDot({
  status,
  pulse = true,
  className,
}: {
  status: DeviceStatus;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)} title={STATUS_LABEL[status]}>
      {pulse && (status === "online" || status === "connecting") && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            STATUS_COLOR[status],
          )}
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", STATUS_COLOR[status])} />
    </span>
  );
}

export function statusLabel(status: DeviceStatus) {
  return STATUS_LABEL[status];
}
