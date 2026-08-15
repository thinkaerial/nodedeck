import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const VARIANTS = {
  neutral: "bg-bg-surface-2 text-text-secondary border-border-default",
  accent: "bg-accent-soft text-accent border-transparent",
  success: "bg-status-online/15 text-status-online border-transparent",
  warning: "bg-status-warning/15 text-status-warning border-transparent",
  error: "bg-status-error/15 text-status-error border-transparent",
} as const;

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
