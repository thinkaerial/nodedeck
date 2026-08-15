import { useEffect, useState, type ReactNode } from "react";
import { LogOut, UserCircle } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useThemeStore, type ThemeChoice } from "../../state/theme";
import { useUIStore } from "../../state/store";
import { useSessionStore } from "../../state/session";
import * as auth from "../../ipc/auth";
import { useRealDevicesStore } from "../../state/realDevices";

function Row({ label, desc, control }: { label: string; desc?: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-[13px]">
      <div>
        <div className="text-text-primary">{label}</div>
        {desc && <div className="text-[11px] text-text-tertiary">{desc}</div>}
      </div>
      {control}
    </div>
  );
}

function Toggle({
  checked,
  defaultChecked,
  onChange,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="relative inline-flex h-5 w-9 cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-bg-surface-2 border border-border-default peer-checked:bg-accent peer-checked:border-accent transition-colors" />
      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
    </label>
  );
}

export function SettingsScreen() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const showDemoDevices = useUIStore((s) => s.showDemoDevices);
  const setShowDemoDevices = useUIStore((s) => s.setShowDemoDevices);
  const autoLockMinutes = useSessionStore((s) => s.autoLockMinutes);
  const setAutoLockMinutes = useSessionStore((s) => s.setAutoLockMinutes);
  const setUnlocked = useSessionStore((s) => s.setUnlocked);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    auth.currentUser().then(setUsername).catch(() => {});
  }, []);

  async function handleLogout() {
    await auth.logout();
    useRealDevicesStore.setState({ devices: [], loaded: false });
    setUnlocked(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Card>
        <CardHeader title="Account" subtitle="Each account has its own separate devices, tasks, and history" />
        <div className="divide-y divide-border-subtle">
          <Row
            label="Signed in as"
            control={
              <div className="flex items-center gap-2">
                <UserCircle size={14} className="text-text-tertiary" />
                <span className="text-text-primary">{username ?? "—"}</span>
                <Button size="sm" variant="ghost" icon={<LogOut size={12} />} onClick={handleLogout}>
                  Switch account
                </Button>
              </div>
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Security" />
        <div className="divide-y divide-border-subtle">
          <Row
            label="Auto-lock"
            desc="Re-prompt for your password (or Touch ID) after this much inactivity"
            control={
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="rounded-md border border-border-default bg-bg-base px-2 py-1 text-[12px] outline-none"
              >
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={0}>Never</option>
              </select>
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Appearance" />
        <div className="divide-y divide-border-subtle">
          <Row
            label="Theme"
            desc="Dark is recommended for dense device views"
            control={
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeChoice)}
                className="rounded-md border border-border-default bg-bg-base px-2 py-1 text-[12px] outline-none"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Data" subtitle="Demo content vs your real devices" />
        <div className="divide-y divide-border-subtle">
          <Row
            label="Show demo devices"
            desc="Mock devices used to preview the UI before real hardware is connected"
            control={<Toggle checked={showDemoDevices} onChange={setShowDemoDevices} />}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Discovery & monitoring" subtitle="Resource budget controls" />
        <div className="divide-y divide-border-subtle">
          <Row label="Scheduled discovery" desc="Off by default — scans are user-triggered" control={<Toggle defaultChecked={false} />} />
          <Row label="Active dashboard interval" desc="5–10s while a device view is open" control={<span className="text-text-tertiary">8s</span>} />
          <Row label="Background inventory interval" desc="30–60s for devices not in view" control={<span className="text-text-tertiary">45s</span>} />
          <Row label="Pause monitoring on battery" control={<Toggle defaultChecked />} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Updates" />
        <div className="divide-y divide-border-subtle">
          <Row label="Channel" control={
            <select className="rounded-md border border-border-default bg-bg-base px-2 py-1 text-[12px] outline-none">
              <option>Stable</option>
              <option>Beta</option>
            </select>
          } />
        </div>
      </Card>
    </div>
  );
}
