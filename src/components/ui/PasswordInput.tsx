import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/cn";

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 pr-8 text-[12px] text-text-primary outline-none focus:border-accent"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
      >
        {visible ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}
