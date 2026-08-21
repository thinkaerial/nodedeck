import { useEffect, useRef, useState, type ReactNode } from "react";
import { Usb, Plug, Unplug, Loader2 } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import * as serial from "../../ipc/serial";
import type { SerialPortEntry } from "../../ipc/serial";
import { useSerialSessionStore } from "../../state/serialSession";

export function SerialScreen() {
  const [ports, setPorts] = useState<SerialPortEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selected = useSerialSessionStore((s) => s.selected);
  const setSelected = useSerialSessionStore((s) => s.setSelected);
  const baudRate = useSerialSessionStore((s) => s.baudRate);
  const parity = useSerialSessionStore((s) => s.parity);
  const stopBits = useSerialSessionStore((s) => s.stopBits);
  const flowControl = useSerialSessionStore((s) => s.flowControl);
  const setConfig = useSerialSessionStore((s) => s.setConfig);
  const sessionId = useSerialSessionStore((s) => s.sessionId);
  const setSessionId = useSerialSessionStore((s) => s.setSessionId);
  const lines = useSerialSessionStore((s) => s.lines);
  const appendLine = useSerialSessionStore((s) => s.appendLine);
  const resetLines = useSerialSessionStore((s) => s.resetLines);

  const [connecting, setConnecting] = useState(false);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    serial
      .listPorts()
      .then((p) => {
        setPorts(p);
        if (p.length && !selected) setSelected(p[0].path);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  useEffect(() => {
    // Subscribed at module scope regardless of sessionId so events keep
    // flowing into the store even if this component briefly isn't mounted
    // in between renders; the sid check still scopes lines to this session.
    const unData = serial.onSerialData((sid, data) => {
      if (sid !== useSerialSessionStore.getState().sessionId) return;
      appendLine(data);
    });
    const unClosed = serial.onSerialClosed((sid) => {
      if (sid !== useSerialSessionStore.getState().sessionId) return;
      appendLine("\n[session closed]");
      setSessionId(null);
    });
    return () => {
      unData.then((u) => u());
      unClosed.then((u) => u());
    };
  }, [appendLine, setSessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  async function handleOpen() {
    if (!selected) return;
    setConnecting(true);
    setError(null);
    resetLines();
    try {
      const id = await serial.openPort(selected, Number(baudRate), parity, stopBits, flowControl);
      setSessionId(id);
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function handleClose() {
    if (sessionId) await serial.closePort(sessionId).catch(() => {});
    setSessionId(null);
  }

  async function handleSend() {
    if (!sessionId || !input) return;
    await serial.writePort(sessionId, `${input}\n`).catch(() => {});
    setInput("");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Card>
        <CardHeader
          title="USB serial devices"
          subtitle="Detected locally on this machine"
          action={
            <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : "Refresh"}
            </Button>
          }
        />
        {error && <div className="px-3 py-2 text-[12px] text-status-error">{error}</div>}
        {!loading && ports.length === 0 && !error && (
          <EmptyState icon={<Usb size={18} />} title="No USB serial devices detected" detail="Plug in a USB-serial adapter and click Refresh." />
        )}
        <div className="divide-y divide-border-subtle">
          {ports.map((p) => (
            <button
              key={p.path}
              onClick={() => setSelected(p.path)}
              disabled={!!sessionId}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] hover:bg-bg-hover disabled:opacity-50 ${
                selected === p.path ? "bg-accent-soft" : ""
              }`}
            >
              <Usb size={15} className="text-text-tertiary" />
              <div className="flex-1">
                <div className="font-mono text-[12px] text-text-primary">{p.path}</div>
                <div className="text-[11px] text-text-tertiary">{p.label}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Session settings" />
        <div className="grid grid-cols-4 gap-3 p-3">
          <Field label="Baud rate">
            <select value={baudRate} onChange={(e) => setConfig({ baudRate: e.target.value })} disabled={!!sessionId} className={selectCls}>
              {["9600", "57600", "115200", "921600"].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Parity">
            <select value={parity} onChange={(e) => setConfig({ parity: e.target.value })} disabled={!!sessionId} className={selectCls}>
              <option value="none">None</option>
              <option value="even">Even</option>
              <option value="odd">Odd</option>
            </select>
          </Field>
          <Field label="Stop bits">
            <select value={stopBits} onChange={(e) => setConfig({ stopBits: e.target.value })} disabled={!!sessionId} className={selectCls}>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </Field>
          <Field label="Flow control">
            <select value={flowControl} onChange={(e) => setConfig({ flowControl: e.target.value })} disabled={!!sessionId} className={selectCls}>
              <option value="none">None</option>
              <option value="rtscts">RTS/CTS</option>
              <option value="xonxoff">XON/XOFF</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-border-subtle p-3">
          {sessionId ? (
            <Button variant="danger" size="sm" icon={<Unplug size={13} />} onClick={handleClose}>
              Close session
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={connecting ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
              disabled={!selected || connecting}
              onClick={handleOpen}
            >
              Open session
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Serial monitor" subtitle={sessionId ? "live" : "not connected"} />
        <div ref={logRef} className="h-56 overflow-auto whitespace-pre-wrap bg-[#0a0c11] p-3 font-mono text-[12px] text-[#c9d1d9]">
          {lines.length === 0 ? (
            <span className="text-text-tertiary">Open a session to see data…</span>
          ) : (
            lines.join("")
          )}
          {sessionId && <span className="inline-block h-[13px] w-[6px] animate-pulse bg-[#c9d1d9] align-middle" />}
        </div>
        <div className="flex gap-2 border-t border-border-subtle p-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={!sessionId}
            placeholder={sessionId ? "Type and press Enter to send…" : "Open a session first"}
            className="flex-1 rounded-md border border-border-default bg-bg-base px-2.5 py-1.5 font-mono text-[12px] text-text-primary outline-none focus:border-accent disabled:opacity-50"
          />
          <Button size="sm" variant="secondary" disabled={!sessionId || !input} onClick={handleSend}>
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}

const selectCls =
  "w-full rounded-md border border-border-default bg-bg-base px-2 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-text-tertiary">{label}</span>
      {children}
    </label>
  );
}
