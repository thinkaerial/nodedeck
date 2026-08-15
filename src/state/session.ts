import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  unlocked: boolean;
  autoLockMinutes: number;
  setUnlocked: (unlocked: boolean) => void;
  setAutoLockMinutes: (minutes: number) => void;
}

/** `unlocked` is intentionally NOT persisted — every app launch starts locked. */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      unlocked: false,
      autoLockMinutes: 10,
      setUnlocked: (unlocked) => set({ unlocked }),
      setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
    }),
    {
      name: "nodedeck-session-prefs",
      partialize: (state) => ({ autoLockMinutes: state.autoLockMinutes }),
    },
  ),
);
