export type ThemeMode = "system" | "light" | "dark";

export const THEME_MODE_STORAGE_KEY = "ev-theme-mode";

export function parseThemeMode(value: unknown): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function nextThemeMode(current: ThemeMode): ThemeMode {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

export function applyThemeMode(mode: ThemeMode, root: Pick<HTMLElement, "setAttribute" | "removeAttribute">): void {
  if (mode === "light" || mode === "dark") {
    root.setAttribute("data-theme", mode);
    return;
  }
  root.removeAttribute("data-theme");
}

