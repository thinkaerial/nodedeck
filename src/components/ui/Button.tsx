import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
}

const VARIANTS = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover border-transparent",
  secondary:
    "bg-bg-surface-2 text-text-primary hover:bg-bg-hover border-border-default",
  ghost: "bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary border-transparent",
  danger: "bg-transparent text-status-error hover:bg-status-error/10 border-border-default",
};

const SIZES = {
  sm: "h-7 px-2 text-xs gap-1.5",
  md: "h-8 px-3 text-[13px] gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
