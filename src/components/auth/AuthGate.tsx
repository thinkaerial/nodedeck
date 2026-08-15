import { useEffect, useState, type ReactNode } from "react";
import { Fingerprint, Lock, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import * as auth from "../../ipc/auth";
import { useSessionStore } from "../../state/session";
import { useIdleLock } from "../../lib/useIdleLock";
import { Button } from "../ui/Button";
import { PasswordInput } from "../ui/PasswordInput";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-base text-text-primary">
      <div className="w-full max-w-xs rounded-lg border border-border-default bg-bg-surface p-5 shadow-[var(--shadow-2)]">
        {children}
      </div>
    </div>
  );
}

function CreateAccountForm({ onCreated, onBack }: { onCreated: () => void; onBack?: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (!username.trim()) return setError("Choose a username");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    try {
      await auth.createAccount(username.trim(), password);
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="text-text-tertiary hover:text-text-primary">
            <ArrowLeft size={15} />
          </button>
        )}
        <ShieldCheck size={18} className="text-accent" />
        <h1 className="text-[14px] font-semibold">{onBack ? "New NodeDeck account" : "Create your NodeDeck account"}</h1>
      </div>
      <p className="mb-3 text-[11px] text-text-tertiary">
        Separate from any device's SSH credentials, and separate per person — each account gets its own
        devices, tasks, and history. Hashed with Argon2id, stored locally.
      </p>
      <div className="space-y-2.5">
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent"
        />
        <PasswordInput placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordInput
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      {error && <div className="mt-2 text-[11px] text-status-error">{error}</div>}
      <Button variant="primary" size="sm" className="mt-3 w-full justify-center" disabled={busy} onClick={submit}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : "Create account"}
      </Button>
    </>
  );
}

function UnlockForm({ onUnlocked, onAddAccount }: { onUnlocked: () => void; onAddAccount: () => void }) {
  const [usernames, setUsernames] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    auth.listUsernames().then((names) => {
      setUsernames(names);
      if (names.length > 0) setUsername(names[0]);
    }).catch(() => {});
    auth.biometricAvailable().then(setBioAvailable).catch(() => setBioAvailable(false));
  }, []);

  async function submitPassword() {
    setError("");
    setBusy(true);
    try {
      const ok = await auth.verifyPassword(username, password);
      if (ok) onUnlocked();
      else setError("Incorrect password");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitBiometric() {
    setError("");
    setBusy(true);
    try {
      const ok = await auth.biometricUnlock(username, `unlock NodeDeck as ${username}`);
      if (ok) onUnlocked();
      else setError("Touch ID failed — use your password");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Lock size={18} className="text-accent" />
        <h1 className="text-[14px] font-semibold">Unlock NodeDeck</h1>
      </div>
      <div className="space-y-2.5">
        {usernames.length > 1 ? (
          <select
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent"
          >
            {usernames.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-[12px] text-text-secondary">{username}</div>
        )}

        {bioAvailable && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            icon={<Fingerprint size={14} />}
            disabled={busy}
            onClick={submitBiometric}
          >
            Unlock with Touch ID
          </Button>
        )}
        <PasswordInput
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitPassword()}
          autoFocus
        />
      </div>
      {error && <div className="mt-2 text-[11px] text-status-error">{error}</div>}
      <Button variant="primary" size="sm" className="mt-3 w-full justify-center" disabled={busy} onClick={submitPassword}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : "Unlock"}
      </Button>
      <button onClick={onAddAccount} className="mt-3 w-full text-center text-[11px] text-text-tertiary hover:text-text-primary">
        + Add another account
      </button>
    </>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const unlocked = useSessionStore((s) => s.unlocked);
  const setUnlocked = useSessionStore((s) => s.setUnlocked);
  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"unlock" | "create">("unlock");

  useIdleLock();

  useEffect(() => {
    auth.accountExists().then(setAccountExists).catch(() => setAccountExists(false));
  }, [unlocked]);

  if (accountExists === null) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 text-[12px] text-text-tertiary">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      </Shell>
    );
  }

  if (!accountExists || (!unlocked && mode === "create")) {
    return (
      <Shell>
        <CreateAccountForm
          onCreated={() => setUnlocked(true)}
          onBack={accountExists ? () => setMode("unlock") : undefined}
        />
      </Shell>
    );
  }

  if (!unlocked) {
    return (
      <Shell>
        <UnlockForm onUnlocked={() => setUnlocked(true)} onAddAccount={() => setMode("create")} />
      </Shell>
    );
  }

  return <>{children}</>;
}
