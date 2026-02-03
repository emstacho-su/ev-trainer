import { describe, expect, it } from "vitest";
import type { StorageLike } from "./storageLike";
import {
  SESSION_INDEX_KEY,
  buildSessionIndexEntry,
  clearAllSessions,
  deleteSession,
  readSessionIndex,
  readSessionRecord,
  sessionRecordKey,
  toPersistedSessionRecord,
  writeSessionIndex,
  writeSessionRecord,
  type PersistedSessionRecord,
  type SessionIndexEntry,
} from "./sessionStorage";

class MemoryStorage implements StorageLike {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

class ThrowingSetItemStorage extends MemoryStorage {
  setItem(): void {
    const error = new Error("quota exceeded for local storage");
    Object.assign(error, { name: "QuotaExceededError", code: 22 });
    throw error;
  }
}

function makeRecord(sessionId: string): PersistedSessionRecord {
  return {
    version: 1,
    sessionId,
    seed: "seed-a",
    mode: "TRAINING",
    packId: "ev-dev-pack-v1",
    filters: { street: "FLOP" },
    decisionIndex: 1,
    decisionsPerSession: 10,
    currentSpot: {
      schemaVersion: "1",
      spotId: "spot-1",
      gameType: "NLHE",
      blinds: { sb: 0.5, bb: 1 },
      positions: ["BTN", "BB"],
      stacksBb: { SB: 0, BB: 100, UTG: 0, HJ: 0, CO: 0, BTN: 100 },
      potBb: 2,
      board: ["Ah", "Kd", "7c"],
      history: ["CHECK"],
      heroToAct: "BTN",
    },
    entries: [],
    createdAt: "2026-02-03T09:00:00.000Z",
    lastUpdated: "2026-02-03T09:01:00.000Z",
  };
}

describe("v2 session storage", () => {
  it("returns an empty index for missing or invalid index JSON", () => {
    const storage = new MemoryStorage();

    expect(readSessionIndex(storage)).toEqual([]);

    storage.setItem(SESSION_INDEX_KEY, "{not-valid-json");
    expect(readSessionIndex(storage)).toEqual([]);
  });

  it("round-trips per-session records", () => {
    const storage = new MemoryStorage();
    const record = makeRecord("sess-1");

    const writeResult = writeSessionRecord(record, storage);

    expect(writeResult).toEqual({ ok: true });
    expect(readSessionRecord("sess-1", storage)).toEqual(record);
  });

  it("round-trips session index and deletes one session without corrupting index", () => {
    const storage = new MemoryStorage();
    const first = makeRecord("sess-1");
    const second = makeRecord("sess-2");

    writeSessionRecord(first, storage);
    writeSessionRecord(second, storage);

    const index: SessionIndexEntry[] = [
      buildSessionIndexEntry(first),
      buildSessionIndexEntry(second),
    ];
    expect(writeSessionIndex(index, storage)).toEqual({ ok: true });

    const result = deleteSession("sess-1", storage);

    expect(result).toEqual({ ok: true });
    expect(readSessionRecord("sess-1", storage)).toBeNull();
    expect(readSessionRecord("sess-2", storage)).toEqual(second);
    expect(readSessionIndex(storage)).toEqual([buildSessionIndexEntry(second)]);
  });

  it("clear-all removes index and all session keys", () => {
    const storage = new MemoryStorage();
    const first = makeRecord("sess-1");
    const second = makeRecord("sess-2");

    writeSessionRecord(first, storage);
    writeSessionRecord(second, storage);
    writeSessionIndex([buildSessionIndexEntry(first), buildSessionIndexEntry(second)], storage);
    storage.setItem("unrelated:key", "keep-me");

    const result = clearAllSessions(storage);

    expect(result).toEqual({ ok: true });
    expect(storage.getItem(sessionRecordKey("sess-1"))).toBeNull();
    expect(storage.getItem(sessionRecordKey("sess-2"))).toBeNull();
    expect(storage.getItem(SESSION_INDEX_KEY)).toBeNull();
    expect(storage.getItem("unrelated:key")).toBe("keep-me");
  });

  it("returns non-blocking warning when setItem fails with quota error", () => {
    const storage = new ThrowingSetItemStorage();
    const result = writeSessionRecord(makeRecord("sess-1"), storage);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected warning result");

    expect(result.warning.code).toBe("QUOTA_EXCEEDED");
    expect(result.warning.message).toContain("full");
  });

  it("creates persisted records from in-memory session records", () => {
    const persisted = toPersistedSessionRecord(
      {
        sessionId: "sess-3",
        seed: "seed-c",
        mode: "PRACTICE",
        packId: "ev-dev-pack-v1",
        filters: {},
        decisionIndex: 2,
        decisionsPerSession: 10,
        currentSpot: null,
        entries: [],
      },
      {
        createdAt: "2026-02-03T09:10:00.000Z",
        lastUpdated: "2026-02-03T09:12:00.000Z",
      }
    );

    expect(persisted).toEqual({
      version: 1,
      sessionId: "sess-3",
      seed: "seed-c",
      mode: "PRACTICE",
      packId: "ev-dev-pack-v1",
      filters: {},
      decisionIndex: 2,
      decisionsPerSession: 10,
      currentSpot: null,
      entries: [],
      createdAt: "2026-02-03T09:10:00.000Z",
      lastUpdated: "2026-02-03T09:12:00.000Z",
    });
  });
});
