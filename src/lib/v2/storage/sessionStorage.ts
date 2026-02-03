import type { Spot } from "../../engine/spot";
import type {
  SessionDetailResponse,
  SessionSnapshot,
  SubmitPracticeResponse,
  SubmitTrainingResponse,
} from "../api/sessionHandlers";
import type { SessionMode } from "../sessionStore";

export const SESSION_INDEX_KEY = "ev-trainer:sessions:index";
export const SESSION_KEY_PREFIX = "ev-trainer:session:";

export interface PersistedSessionIndexItem {
  sessionId: string;
  seed?: string;
  mode: SessionMode;
  packId: string;
  decisionIndex: number;
  decisionsPerSession: number;
  isComplete: boolean;
  lastUpdated?: string;
}

export interface PersistedSessionRecord {
  session: SessionSnapshot;
  currentSpot: Spot | null;
  reviewAvailable?: boolean;
  lastSubmit?: SubmitTrainingResponse | SubmitPracticeResponse;
  startedAt?: string;
  completedAt?: string;
  aggregates?: PersistedSessionAggregates;
}

export interface PersistedSessionAggregates {
  volume: number;
  meanEvLoss: number;
  bestActionRate: number;
  durationMs: number;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage ?? null;
}

function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Swallow storage failures (quota/private mode) to keep UI non-blocking.
  }
}

function safeRemoveItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Swallow storage failures (quota/private mode) to keep UI non-blocking.
  }
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function buildIndexItem(record: PersistedSessionRecord): PersistedSessionIndexItem {
  return {
    sessionId: record.session.sessionId,
    seed: record.session.seed,
    mode: record.session.mode,
    packId: record.session.packId,
    decisionIndex: record.session.decisionIndex,
    decisionsPerSession: record.session.decisionsPerSession,
    isComplete: record.session.isComplete,
    lastUpdated: record.completedAt ?? record.startedAt,
  };
}

function sessionKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

export function readSessionIndex(): PersistedSessionIndexItem[] {
  const storage = getStorage();
  if (!storage) return [];
  return parseJson<PersistedSessionIndexItem[]>(
    safeGetItem(storage, SESSION_INDEX_KEY),
    []
  );
}

export function readSessionRecord(
  sessionId: string
): PersistedSessionRecord | null {
  const storage = getStorage();
  if (!storage) return null;
  return parseJson<PersistedSessionRecord | null>(
    safeGetItem(storage, sessionKey(sessionId)),
    null
  );
}

export function writeSessionIndex(items: PersistedSessionIndexItem[]): void {
  const storage = getStorage();
  if (!storage) return;
  safeSetItem(storage, SESSION_INDEX_KEY, JSON.stringify(items));
}

export function writeSessionRecord(record: PersistedSessionRecord): void {
  const storage = getStorage();
  if (!storage) return;
  safeSetItem(storage, sessionKey(record.session.sessionId), JSON.stringify(record));

  const current = readSessionIndex().filter(
    (item) => item.sessionId !== record.session.sessionId
  );
  writeSessionIndex([buildIndexItem(record), ...current]);
}

export function updateFromSessionDetail(detail: SessionDetailResponse, spot?: Spot | null): void {
  const previous = readSessionRecord(detail.session.sessionId);
  const completedAt =
    detail.session.isComplete && !previous?.completedAt
      ? new Date().toISOString()
      : previous?.completedAt;
  writeSessionRecord({
    session: detail.session,
    currentSpot: spot === undefined ? previous?.currentSpot ?? null : spot,
    reviewAvailable: detail.reviewAvailable,
    lastSubmit: previous?.lastSubmit,
    startedAt: previous?.startedAt,
    completedAt,
    aggregates: previous?.aggregates,
  });
}

export function updateSessionRecord(
  sessionId: string,
  updater: (previous: PersistedSessionRecord | null) => PersistedSessionRecord | null
): void {
  const previous = readSessionRecord(sessionId);
  const next = updater(previous);
  if (!next) return;
  writeSessionRecord(next);
}

export function deleteSessionRecord(sessionId: string): void {
  const storage = getStorage();
  if (!storage) return;
  safeRemoveItem(storage, sessionKey(sessionId));
  const next = readSessionIndex().filter((item) => item.sessionId !== sessionId);
  writeSessionIndex(next);
}

export function clearAllSessionRecords(): void {
  const storage = getStorage();
  if (!storage) return;
  const index = readSessionIndex();
  for (const item of index) {
    safeRemoveItem(storage, sessionKey(item.sessionId));
  }
  safeRemoveItem(storage, SESSION_INDEX_KEY);
}
