/**
 * Tests for localStorage config persistence layer.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadConfigFromStorage, saveConfigToStorage } from "./configStore";
import { getDefaultConfig } from "./validation";
import type { TrainerConfig } from "./types";

// Mock localStorage using a simple Map-backed implementation
const mockStorage = new Map<string, string>();

const localStorageMock: Storage = {
  getItem(key: string) {
    return mockStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    mockStorage.set(key, value);
  },
  removeItem(key: string) {
    mockStorage.delete(key);
  },
  clear() {
    mockStorage.clear();
  },
  get length() {
    return mockStorage.size;
  },
  key(_index: number) {
    return null;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("configStore", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe("loadConfigFromStorage", () => {
    it("returns defaults when localStorage is empty", () => {
      const config = loadConfigFromStorage();
      const defaults = getDefaultConfig();
      expect(config).toEqual(defaults);
    });

    it("returns stored config when valid", () => {
      const stored: TrainerConfig = {
        mode: "PREFLOP",
        gameType: "CASH",
        tableSize: "6max",
        stackDepth: "200bb",
        villainAlwaysRaise: true,
        positions: ["UTG", "CO"],
        potTypes: ["3BP"],
      };
      mockStorage.set("trainer-config", JSON.stringify(stored));

      const config = loadConfigFromStorage();
      expect(config.stackDepth).toBe("200bb");
      expect(config.villainAlwaysRaise).toBe(true);
      expect(config.positions).toEqual(["UTG", "CO"]);
      expect(config.potTypes).toEqual(["3BP"]);
    });

    it("returns defaults when stored config has invalid JSON", () => {
      mockStorage.set("trainer-config", "{not-valid-json");

      const config = loadConfigFromStorage();
      expect(config).toEqual(getDefaultConfig());
    });

    it("returns defaults when stored config fails validation", () => {
      // Empty positions array violates min(1) rule
      const invalid = {
        mode: "PREFLOP",
        gameType: "CASH",
        tableSize: "6max",
        stackDepth: "100bb",
        villainAlwaysRaise: false,
        positions: [],
        potTypes: ["SRP"],
      };
      mockStorage.set("trainer-config", JSON.stringify(invalid));

      const config = loadConfigFromStorage();
      expect(config).toEqual(getDefaultConfig());
    });

    it("applies defaults for missing fields in stored config", () => {
      // Partial config - Zod should fill in defaults
      const partial = {
        mode: "FLOP",
        positions: ["BTN"],
        potTypes: ["SRP"],
      };
      mockStorage.set("trainer-config", JSON.stringify(partial));

      const config = loadConfigFromStorage();
      expect(config.mode).toBe("FLOP");
      expect(config.gameType).toBe("CASH"); // default
      expect(config.stackDepth).toBe("100bb"); // default
      expect(config.villainAlwaysRaise).toBe(false); // default
      expect(config.positions).toEqual(["BTN"]); // provided
    });
  });

  describe("saveConfigToStorage", () => {
    it("saves valid config to localStorage", () => {
      const config: TrainerConfig = {
        mode: "PREFLOP",
        gameType: "CASH",
        tableSize: "6max",
        stackDepth: "100bb",
        villainAlwaysRaise: false,
        positions: ["BB", "SB"],
        potTypes: ["SRP"],
      };

      saveConfigToStorage(config);

      const stored = mockStorage.get("trainer-config");
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.mode).toBe("PREFLOP");
      expect(parsed.positions).toEqual(["BB", "SB"]);
    });

    it("round-trips config data correctly", () => {
      const original: TrainerConfig = {
        mode: "FLOP",
        gameType: "HU",
        tableSize: "9max",
        stackDepth: "50bb",
        villainAlwaysRaise: true,
        positions: ["CO", "BTN"],
        potTypes: ["SRP", "3BP"],
        handCountTarget: 50,
      };

      saveConfigToStorage(original);
      const loaded = loadConfigFromStorage();

      expect(loaded).toEqual(original);
    });

    it("handles localStorage quota errors gracefully", () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = () => {
        throw new DOMException("QuotaExceededError");
      };

      const config = getDefaultConfig();
      // Should not throw
      expect(() => saveConfigToStorage(config)).not.toThrow();

      // Restore
      localStorageMock.setItem = originalSetItem;
    });
  });
});
