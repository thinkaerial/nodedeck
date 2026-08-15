import { useEffect, useRef } from "react";
import { useSessionStore } from "../state/session";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"] as const;

export function useIdleLock() {
  const unlocked = useSessionStore((s) => s.unlocked);
  const autoLockMinutes = useSessionStore((s) => s.autoLockMinutes);
  const setUnlocked = useSessionStore((s) => s.setUnlocked);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!unlocked || autoLockMinutes <= 0) return;

    function reset() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setUnlocked(false), autoLockMinutes * 60_000);
    }

    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [unlocked, autoLockMinutes, setUnlocked]);
}
