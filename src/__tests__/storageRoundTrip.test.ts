import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PersistedSessionRecord } from "../lib/v2/storage/sessionStorage";
import {
  SESSION_INDEX_KEY,
  SESSION_KEY_PREFIX,
  clearAllSessionRecords,
  consumeStorageWarning,
  deleteSessionRecord,
  readSessionIndex,
  readSessionRecord,
  writeSessionRecord,
} from "../lib/v2/storage/sessionStorage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class ThrowingStorage implements Storage {
  get length(): number {
    return 0;
  }

  clear(): void {
    throw new Error("storage blocked");
  }

  getItem(): string | null {
    throw new Error("storage blocked");
  }

  key(): string | null {
    return null;
  }

  removeItem(): void {
    throw new Error("storage blocked");
  }

  setItem(): void {
    throw new Error("storage blocked");
  }
}

function makeRecord(sessionId: string): PersistedSessionRecord {
  return {
    session: {
      sessionId,
      seed: "seed-a",
      mode: "TRAINING",
      packId: "ev-dev-pack-v1",
      decisionIndex: 0,
      decisionsPerSession: 3,
      isComplete: false,
      filters: { street: "FLOP" },
    },
    currentSpot: null,
    reviewAvailable: false,
    startedAt: "2026-02-03T00:00:00.000Z",
  };
}

beforeEach(() => {
  (globalThis as { window?: { localStorage: Storage } }).window = {
    localStorage: new MemoryStorage(),
  };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("session storage round-trip", () => {
  it("round-trips a session record and index metadata", () => {
    const record = makeRecord("sess-roundtrip");
    writeSessionRecord(record);

    expect(readSessionRecord(record.session.sessionId)).toEqual(record);
    expect(readSessionIndex()).toEqual([
      {
        sessionId: "sess-roundtrip",
        seed: "seed-a",
        mode: "TRAINING",
        packId: "ev-dev-pack-v1",
        decisionIndex: 0,
        decisionsPerSession: 3,
        isComplete: false,
        lastUpdated: "2026-02-03T00:00:00.000Z",
      },
    ]);
  });

  it("keeps the index in sync when deleting and clearing records", () => {
    writeSessionRecord(makeRecord("sess-a"));
    writeSessionRecord(makeRecord("sess-b"));

    deleteSessionRecord("sess-a");
    expect(readSessionRecord("sess-a")).toBeNull();
    expect(readSessionIndex().map((item) => item.sessionId)).toEqual(["sess-b"]);

    clearAllSessionRecords();
    expect(readSessionIndex()).toEqual([]);
    expect(readSessionRecord("sess-b")).toBeNull();
  });

  it("returns safe defaults on corrupt JSON", () => {
    const storage = (window as { localStorage: Storage }).localStorage;
    storage.setItem(SESSION_INDEX_KEY, "{");
    storage.setItem(`${SESSION_KEY_PREFIX}sess-corrupt`, "{");

    expect(readSessionIndex()).toEqual([]);
    expect(readSessionRecord("sess-corrupt")).toBeNull();
  });

  it("does not throw when localStorage is blocked or quota-limited", () => {
    (globalThis as { window?: { localStorage: Storage } }).window = {
      localStorage: new ThrowingStorage(),
    };

    const record = makeRecord("sess-blocked");
    expect(() => writeSessionRecord(record)).not.toThrow();
    expect(() => deleteSessionRecord(record.session.sessionId)).not.toThrow();
    expect(() => clearAllSessionRecords()).not.toThrow();
    expect(consumeStorageWarning()).toContain("Storage is unavailable");
    expect(readSessionIndex()).toEqual([]);
    expect(readSessionRecord(record.session.sessionId)).toBeNull();
  });
});
