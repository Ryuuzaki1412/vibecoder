import { useCallback, useEffect, useState } from "react";
import type { EditorFont } from "../lib/storage";
import { loadUIPrefs, saveUIPrefs } from "../lib/storage";
import type { ThemeMode } from "../components/Icon";

interface UISettings {
  theme: ThemeMode;
  editorFont: EditorFont;
}

export function useUISettings(): UISettings & {
  setTheme: (t: ThemeMode) => void;
  setEditorFont: (f: EditorFont) => void;
} {
  const [prefs, setPrefs] = useState(() => loadUIPrefs());

  // Apply editor font to <html> as a class so global CSS can react
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("font-default", "font-songti", "font-sans", "font-mono");
    root.classList.add(`font-${prefs.editorFont}`);
    root.classList.toggle("dark", prefs.theme === "dark");
  }, [prefs.editorFont, prefs.theme]);

  // Persist on every change
  useEffect(() => {
    saveUIPrefs(prefs);
  }, [prefs]);

  const setTheme = useCallback((theme: ThemeMode) => {
    setPrefs((prev) => ({ ...prev, theme }));
  }, []);
  const setEditorFont = useCallback((editorFont: EditorFont) => {
    setPrefs((prev) => ({ ...prev, editorFont }));
  }, []);

  return { ...prefs, setTheme, setEditorFont };
}