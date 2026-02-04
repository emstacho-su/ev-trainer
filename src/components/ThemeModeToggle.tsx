"use client";

import { useEffect, useState } from "react";
import {
  applyThemeMode,
  nextThemeMode,
  parseThemeMode,
  THEME_MODE_STORAGE_KEY,
  type ThemeMode,
} from "../lib/ui/themeMode";

function modeLabel(mode: ThemeMode): string {
  if (mode === "system") return "Theme: System";
  if (mode === "light") return "Theme: Light";
  return "Theme: Dark";
}

export default function ThemeModeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const root = document.documentElement;
    const stored = parseThemeMode(window.localStorage.getItem(THEME_MODE_STORAGE_KEY));
    setMode(stored);
    applyThemeMode(stored, root);
  }, []);

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => {
        const root = document.documentElement;
        const next = nextThemeMode(mode);
        setMode(next);
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, next);
        applyThemeMode(next, root);
      }}
      aria-label="Toggle theme mode"
      title="Toggle theme mode"
    >
      {modeLabel(mode)}
    </button>
  );
}

