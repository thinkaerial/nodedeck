import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-bg-surface shadow-[var(--shadow-1)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between border-b border-border-subtle px-3 py-2.5", className)}>
      <div>
        <h3 className="text-[13px] font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-text-tertiary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
