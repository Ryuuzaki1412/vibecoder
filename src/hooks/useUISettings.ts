import { useCallback, useEffect, useState } from "react";
import { loadUIPrefs, saveUIPrefs } from "../lib/storage";
import type { ThemeMode } from "../components/Icon";

interface UISettings {
  theme: ThemeMode;
}

export function useUISettings(): UISettings & {
  setTheme: (t: ThemeMode) => void;
} {
  const [prefs, setPrefs] = useState(() => loadUIPrefs());

  // Apply theme to <html>. The font is always sans — no class needed.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
  }, [prefs.theme]);

  // Persist on every change
  useEffect(() => {
    saveUIPrefs(prefs);
  }, [prefs]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setPrefs((prev) => ({ ...prev, theme }));
  }, []);

  return { ...prefs, setTheme };
}