import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { openPty, writePty, resizePty, closePty, onPtyData, onPtyClosed, onPtyError } from "../../ipc/ssh";
import type { ConnectionParams } from "../../ipc/types";

export interface RealTerminalHandle {
  sendCommand: (command: string) => void;
}

export const RealTerminal = forwardRef<RealTerminalHandle, { connection: ConnectionParams }>(
  function RealTerminal({ connection }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(true);
    const sessionIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      sendCommand(command: string) {
        if (sessionIdRef.current) writePty(sessionIdRef.current, `${command}\n`).catch(() => {});
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new XTerm({
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        theme: {
          background: "#0a0c11",
          foreground: "#c9d1d9",
          cursor: "#22d3ee",
        },
        cursorBlink: true,
        convertEol: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      let disposed = false;
      const unlisteners: (() => void)[] = [];

      async function start() {
        term.writeln(`Connecting to ${connection.username}@${connection.host}:${connection.port}…\r\n`);
        try {
          const unData = await onPtyData((sid, data) => {
            if (sid === sessionIdRef.current) term.write(data);
          });
          const unClosed = await onPtyClosed((sid) => {
            if (sid === sessionIdRef.current) term.writeln("\r\n\r\n[session closed]");
          });
          const unError = await onPtyError((sid, message) => {
            if (sessionIdRef.current === null || sid === sessionIdRef.current) {
              setError(message);
              term.writeln(`\r\n[error] ${message}`);
            }
          });
          unlisteners.push(unData, unClosed, unError);

          const sessionId = await openPty(connection);
          sessionIdRef.current = sessionId;
          if (disposed) {
            closePty(sessionId).catch(() => {});
            return;
          }
          setConnecting(false);
          resizePty(sessionId, term.cols, term.rows).catch(() => {});

          term.onData((data) => {
            if (sessionIdRef.current) writePty(sessionIdRef.current, data).catch(() => {});
          });
        } catch (e) {
          setError(String(e));
          setConnecting(false);
          term.writeln(`\r\n[connection failed] ${String(e)}`);
        }
      }

      start();

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (sessionIdRef.current) resizePty(sessionIdRef.current, term.cols, term.rows).catch(() => {});
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        disposed = true;
        resizeObserver.disconnect();
        unlisteners.forEach((u) => u());
        if (sessionIdRef.current) closePty(sessionIdRef.current).catch(() => {});
        sessionIdRef.current = null;
        term.dispose();
      };
    }, [connection]);

    return (
      <div className="relative h-full w-full bg-[#0a0c11]">
        {connecting && !error && (
          <div className="absolute right-2 top-2 z-10 rounded bg-bg-surface-2 px-2 py-1 text-[11px] text-text-tertiary">
            Connecting…
          </div>
        )}
        <div ref={containerRef} className="h-full w-full p-2" />
      </div>
    );
  },
);
