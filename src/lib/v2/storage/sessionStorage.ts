import type { SessionMode, SessionRecord } from "../sessionStore";
import type { SpotFilterInput } from "../filters/spotFilters";
import type { StorageLike } from "./storageLike";
import { getBrowserStorage } from "./storageLike";

export const SESSION_INDEX_KEY = "ev-trainer:sessions:index";

export interface SessionIndexEntry {
  sessionId: string;
  mode: SessionMode;
  seed: string;
  packId: string;
  createdAt: string;
  lastUpdated: string;
}

export interface PersistedSessionRecord {
  version: 1;
  sessionId: string;
  seed: string;
  mode: SessionMode;
  packId: string;
  filters: SpotFilterInput;
  decisionIndex: number;
  decisionsPerSession: number;
  currentSpot: SessionRecord["currentSpot"];
  entries: SessionRecord["entries"];
  createdAt: string;
  lastUpdated: string;
}

export type StorageWarningCode = "QUOTA_EXCEEDED" | "STORAGE_WRITE_FAILED";

export interface StorageWarning {
  code: StorageWarningCode;
  message: string;
}

export type StorageWriteResult = { ok: true } | { ok: false; warning: StorageWarning };

function resolveStorage(storage?: StorageLike): StorageLike | null {
  return storage ?? getBrowserStorage();
}

function createWarning(error: unknown): StorageWarning {
  if (isQuotaExceededError(error)) {
    return {
      code: "QUOTA_EXCEEDED",
      message: "Local session storage is full. Progress may not persist.",
    };
  }

  return {
    code: "STORAGE_WRITE_FAILED",
    message: "Unable to persist session data to local storage.",
  };
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const domError = error as { name?: string; code?: number; message?: string };
  if (domError.name === "QuotaExceededError") return true;
  if (domError.code === 22 || domError.code === 1014) return true;
  return typeof domError.message === "string" && /quota/i.test(domError.message);
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(
  storage: StorageLike | null,
  action: (target: StorageLike) => void
): StorageWriteResult {
  if (!storage) {
    return {
      ok: false,
      warning: {
        code: "STORAGE_WRITE_FAILED",
        message: "Local storage is unavailable in this environment.",
      },
    };
  }

  try {
    action(storage);
    return { ok: true };
  } catch (error) {
    return { ok: false, warning: createWarning(error) };
  }
}

export function sessionRecordKey(sessionId: string): string {
  return `ev-trainer:session:${sessionId}`;
}

export function readSessionIndex(storage?: StorageLike): SessionIndexEntry[] {
  const resolved = resolveStorage(storage);
  if (!resolved) return [];

  const parsed = safeJsonParse<unknown>(resolved.getItem(SESSION_INDEX_KEY), []);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isSessionIndexEntry);
}

function isSessionIndexEntry(value: unknown): value is SessionIndexEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.mode === "string" &&
    typeof candidate.seed === "string" &&
    typeof candidate.packId === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.lastUpdated === "string"
  );
}

export function writeSessionIndex(
  index: SessionIndexEntry[],
  storage?: StorageLike
): StorageWriteResult {
  const resolved = resolveStorage(storage);
  return safeWrite(resolved, (target) => {
    target.setItem(SESSION_INDEX_KEY, JSON.stringify(index));
  });
}

export function readSessionRecord(
  sessionId: string,
  storage?: StorageLike
): PersistedSessionRecord | null {
  const resolved = resolveStorage(storage);
  if (!resolved) return null;

  const parsed = safeJsonParse<unknown>(resolved.getItem(sessionRecordKey(sessionId)), null);
  if (!isPersistedSessionRecord(parsed)) return null;
  return parsed;
}

function isPersistedSessionRecord(value: unknown): value is PersistedSessionRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  return (
    candidate.version === 1 &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.seed === "string" &&
    typeof candidate.mode === "string" &&
    typeof candidate.packId === "string" &&
    typeof candidate.filters === "object" &&
    typeof candidate.decisionIndex === "number" &&
    typeof candidate.decisionsPerSession === "number" &&
    Array.isArray(candidate.entries) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.lastUpdated === "string"
  );
}

export function writeSessionRecord(
  record: PersistedSessionRecord,
  storage?: StorageLike
): StorageWriteResult {
  const resolved = resolveStorage(storage);
  return safeWrite(resolved, (target) => {
    target.setItem(sessionRecordKey(record.sessionId), JSON.stringify(record));
  });
}

export function deleteSession(
  sessionId: string,
  storage?: StorageLike
): StorageWriteResult {
  const resolved = resolveStorage(storage);
  if (!resolved) {
    return {
      ok: false,
      warning: {
        code: "STORAGE_WRITE_FAILED",
        message: "Local storage is unavailable in this environment.",
      },
    };
  }

  try {
    resolved.removeItem(sessionRecordKey(sessionId));
    const remaining = readSessionIndex(resolved).filter(
      (entry) => entry.sessionId !== sessionId
    );
    resolved.setItem(SESSION_INDEX_KEY, JSON.stringify(remaining));
    return { ok: true };
  } catch (error) {
    return { ok: false, warning: createWarning(error) };
  }
}

export function clearAllSessions(storage?: StorageLike): StorageWriteResult {
  const resolved = resolveStorage(storage);
  if (!resolved) {
    return {
      ok: false,
      warning: {
        code: "STORAGE_WRITE_FAILED",
        message: "Local storage is unavailable in this environment.",
      },
    };
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < resolved.length; index += 1) {
      const key = resolved.key(index);
      if (!key) continue;
      if (key.startsWith("ev-trainer:session:")) keysToRemove.push(key);
    }

    for (const key of keysToRemove) {
      resolved.removeItem(key);
    }
    resolved.removeItem(SESSION_INDEX_KEY);

    return { ok: true };
  } catch (error) {
    return { ok: false, warning: createWarning(error) };
  }
}

export function buildSessionIndexEntry(record: PersistedSessionRecord): SessionIndexEntry {
  return {
    sessionId: record.sessionId,
    mode: record.mode,
    seed: record.seed,
    packId: record.packId,
    createdAt: record.createdAt,
    lastUpdated: record.lastUpdated,
  };
}

export function toPersistedSessionRecord(
  record: SessionRecord,
  metadata: { createdAt: string; lastUpdated: string }
): PersistedSessionRecord {
  return {
    version: 1,
    sessionId: record.sessionId,
    seed: record.seed,
    mode: record.mode,
    packId: record.packId,
    filters: record.filters,
    decisionIndex: record.decisionIndex,
    decisionsPerSession: record.decisionsPerSession,
    currentSpot: record.currentSpot,
    entries: record.entries,
    createdAt: metadata.createdAt,
    lastUpdated: metadata.lastUpdated,
  };
}
