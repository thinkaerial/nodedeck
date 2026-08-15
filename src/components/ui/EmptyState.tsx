import type { ReactNode } from "react";
import { Construction } from "lucide-react";

export function EmptyState({
  title,
  detail,
  icon,
}: {
  title: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-surface-2 text-text-tertiary">
        {icon ?? <Construction size={18} />}
      </div>
      <div className="text-[13px] font-medium text-text-primary">{title}</div>
      {detail && <div className="max-w-sm text-[12px] text-text-tertiary">{detail}</div>}
    </div>
  );
}
