import { create } from "zustand";

export type ThemeChoice = "dark" | "light" | "system";

interface ThemeState {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}

function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement;
  if (theme === "system") {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    root.dataset.theme = prefersLight ? "light" : "dark";
  } else {
    root.dataset.theme = theme;
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "dark",
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
