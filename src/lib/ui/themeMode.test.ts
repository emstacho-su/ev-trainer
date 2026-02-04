import { describe, expect, it, vi } from "vitest";
import { applyThemeMode, nextThemeMode, parseThemeMode } from "./themeMode";

describe("themeMode helpers", () => {
  it("parses supported modes and falls back to system", () => {
    expect(parseThemeMode("light")).toBe("light");
    expect(parseThemeMode("dark")).toBe("dark");
    expect(parseThemeMode("system")).toBe("system");
    expect(parseThemeMode("bad")).toBe("system");
  });

  it("cycles mode in deterministic order", () => {
    expect(nextThemeMode("system")).toBe("light");
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("system");
  });

  it("applies and clears data-theme attribute", () => {
    const setAttribute = vi.fn();
    const removeAttribute = vi.fn();
    const root = { setAttribute, removeAttribute };

    applyThemeMode("light", root);
    expect(setAttribute).toHaveBeenCalledWith("data-theme", "light");

    applyThemeMode("dark", root);
    expect(setAttribute).toHaveBeenCalledWith("data-theme", "dark");

    applyThemeMode("system", root);
    expect(removeAttribute).toHaveBeenCalledWith("data-theme");
  });
});

