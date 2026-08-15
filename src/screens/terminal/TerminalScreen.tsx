import { useRef, useState } from "react";
import { Plus, X, SplitSquareHorizontal } from "lucide-react";
import { useDevice, useDeviceConnection } from "../../lib/useDevice";
import { quickCommands } from "../../mocks/data";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import { RealTerminal, type RealTerminalHandle } from "../../components/terminal/RealTerminal";

const MOCK_OUTPUT = [
  "pi@drone-01:~$ uname -a",
  "Linux drone-01 6.6.31-v8+ #1 SMP PREEMPT aarch64 GNU/Linux",
  "pi@drone-01:~$ uptime",
  " 14:02:11 up 3 days,  4:12,  1 user,  load average: 0.42, 0.38, 0.35",
  "pi@drone-01:~$ ",
];

export function TerminalScreen() {
  const device = useDevice();
  const connection = useDeviceConnection();
  const [tabs] = useState([`${device.alias} — main`, `${device.alias} — logs`]);
  const [activeTab, setActiveTab] = useState(0);
  const terminalRef = useRef<RealTerminalHandle>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border-subtle bg-bg-surface px-2 py-1.5">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setActiveTab(i)}
            className={cn(
              "flex items-center gap-2 rounded-t-md border-b-2 px-2.5 py-1 text-[12px]",
              activeTab === i
                ? "border-accent text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary",
            )}
          >
            {t}
            <X size={11} className="opacity-60 hover:opacity-100" />
          </button>
        ))}
        <Button variant="ghost" size="sm" icon={<Plus size={13} />} />
        <div className="ml-auto flex items-center gap-1">
          {connection && (
            <span className="rounded bg-status-online/15 px-2 py-0.5 text-[11px] font-medium text-status-online">
              live SSH
            </span>
          )}
          <Button variant="ghost" size="sm" icon={<SplitSquareHorizontal size={13} />}>
            Split
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {connection ? (
          <RealTerminal ref={terminalRef} key={`${device.id}-${activeTab}`} connection={connection} />
        ) : (
          <div className="flex-1 overflow-auto bg-[#0a0c11] p-3 font-mono text-[12.5px] leading-relaxed text-[#c9d1d9]">
            {MOCK_OUTPUT.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap">
                {line}
              </div>
            ))}
            <span className="inline-block h-[14px] w-[7px] animate-pulse bg-[#c9d1d9] align-middle" />
          </div>
        )}

        <aside className="w-56 shrink-0 border-l border-border-subtle bg-bg-surface p-2">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Quick commands
          </div>
          <div className="space-y-1">
            {quickCommands.map((qc) => (
              <button
                key={qc.id}
                disabled={!connection}
                onClick={() => terminalRef.current?.sendCommand(qc.command)}
                title={connection ? qc.command : "Connect a real device to run commands"}
                className="block w-full rounded-md px-2 py-1.5 text-left text-[12px] text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none"
              >
                {qc.label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
