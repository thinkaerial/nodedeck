import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function StatTile({
  label,
  value,
  unit,
  icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  tone?: "neutral" | "warning" | "error";
  className?: string;
}) {
  const toneClass =
    tone === "warning" ? "text-status-warning" : tone === "error" ? "text-status-error" : "text-text-primary";

  return (
    <div className={cn("rounded-lg border border-border-subtle bg-bg-surface p-3", className)}>
      <div className="flex items-center justify-between text-text-tertiary">
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className={cn("mt-1.5 flex items-baseline gap-1 font-mono text-xl font-semibold", toneClass)}>
        {value}
        {unit && <span className="text-[11px] font-normal text-text-tertiary">{unit}</span>}
      </div>
    </div>
  );
}
