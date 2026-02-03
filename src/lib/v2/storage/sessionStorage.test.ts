import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PersistedSessionRecord } from "./sessionStorage";
import {
  clearAllSessionRecords,
  consumeStorageWarning,
  deleteSessionRecord,
  readSessionIndex,
  readSessionRecord,
  updateFromSessionDetail,
  updateSessionRecord,
  writeSessionRecord,
} from "./sessionStorage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

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
    throw new Error("blocked");
  }
  getItem(): string | null {
    throw new Error("blocked");
  }
  key(): string | null {
    return null;
  }
  removeItem(): void {
    throw new Error("blocked");
  }
  setItem(): void {
    throw new Error("blocked");
  }
}

const sample: PersistedSessionRecord = {
  session: {
    sessionId: "s1",
    seed: "seed-a",
    mode: "TRAINING",
    packId: "ev-dev-pack-v1",
    decisionIndex: 0,
    decisionsPerSession: 10,
    isComplete: false,
    filters: {},
  },
  currentSpot: null,
};

beforeEach(() => {
  (globalThis as { window?: { localStorage: Storage } }).window = {
    localStorage: new MemoryStorage(),
  };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("sessionStorage", () => {
  it("writes and reads session records and index", () => {
    writeSessionRecord(sample);
    const record = readSessionRecord(sample.session.sessionId);
    expect(record?.session.seed).toBe("seed-a");

    const index = readSessionIndex();
    expect(index).toHaveLength(1);
    expect(index[0]?.sessionId).toBe("s1");
  });

  it("deletes one session without corrupting the index", () => {
    writeSessionRecord(sample);
    writeSessionRecord({
      ...sample,
      session: {
        ...sample.session,
        sessionId: "s2",
      },
    });
    deleteSessionRecord("s1");
    expect(readSessionRecord("s1")).toBeNull();
    const index = readSessionIndex();
    expect(index).toHaveLength(1);
    expect(index[0]?.sessionId).toBe("s2");
  });

  it("clears all sessions", () => {
    writeSessionRecord(sample);
    clearAllSessionRecords();
    expect(readSessionIndex()).toEqual([]);
    expect(readSessionRecord("s1")).toBeNull();
  });

  it("marks completedAt when a completed session detail is observed", () => {
    writeSessionRecord(sample);
    updateFromSessionDetail({
      ok: true,
      session: { ...sample.session, isComplete: true },
      reviewAvailable: true,
      entries: [],
    });
    const record = readSessionRecord("s1");
    expect(record?.completedAt).toBeTruthy();
  });

  it("updates session record with updater helper", () => {
    writeSessionRecord(sample);
    updateSessionRecord("s1", (previous) => {
      if (!previous) return null;
      return {
        ...previous,
        startedAt: "2026-02-03T00:00:00.000Z",
      };
    });
    expect(readSessionRecord("s1")?.startedAt).toBe("2026-02-03T00:00:00.000Z");
  });

  it("exposes non-blocking storage warning on storage failures", () => {
    (globalThis as { window?: { localStorage: Storage } }).window = {
      localStorage: new ThrowingStorage(),
    };
    writeSessionRecord(sample);
    expect(consumeStorageWarning()).toContain("Storage is unavailable");
    expect(consumeStorageWarning()).toBeNull();
  });
});
