/**
 * Overview: In-memory app-layer session record store for current run state.
 * Interacts with: session handlers and runtime keying utilities.
 * Importance: Tracks current spot and submitted entries per session.
 *
 * NOTE: All methods are async to support future Prisma-based persistence.
 * The InMemorySessionStoreBackend uses Promise.resolve() for compatibility.
 */

import type { DecisionGrade } from "../engine/trainingOrchestrator";
import type { ActionId } from "../engine/types";
import type { Spot } from "../engine/spot";
import { runtimeKeyFrom } from "../runtime/runtimeKey";
import type { SpotFilterInput } from "./filters/spotFilters";

export type SessionMode = "TRAINING" | "PRACTICE";

export interface SessionEntry {
  index: number;
  spotId: string;
  spot: Spot;
  actionId: ActionId;
  result?: DecisionGrade;
}

export interface SessionRecord {
  sessionId: string;
  seed: string;
  mode: SessionMode;
  packId: string;
  filters: SpotFilterInput;
  decisionIndex: number;
  decisionsPerSession: number;
  currentSpot: Spot | null;
  entries: SessionEntry[];
}

export interface SessionStoreBackend {
  get(key: string): Promise<SessionRecord | undefined>;
  set(key: string, value: SessionRecord): Promise<void>;
  clear(): Promise<void>;
}

class InMemorySessionStoreBackend implements SessionStoreBackend {
  private readonly store = new Map<string, SessionRecord>();

  async get(key: string): Promise<SessionRecord | undefined> {
    return Promise.resolve(this.store.get(key));
  }

  async set(key: string, value: SessionRecord): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  async clear(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }
}

let backend: SessionStoreBackend = new InMemorySessionStoreBackend();

export async function createSessionRecord(input: {
  sessionId: string;
  seed: string;
  mode: SessionMode;
  packId: string;
  filters: SpotFilterInput;
  decisionIndex: number;
  decisionsPerSession: number;
}): Promise<SessionRecord> {
  const key = runtimeKeyFrom(input.seed, input.sessionId);
  const existing = await backend.get(key);
  if (existing) return existing;
  const record: SessionRecord = {
    sessionId: input.sessionId,
    seed: input.seed,
    mode: input.mode,
    packId: input.packId,
    filters: input.filters,
    decisionIndex: input.decisionIndex,
    decisionsPerSession: input.decisionsPerSession,
    currentSpot: null,
    entries: [],
  };
  await backend.set(key, record);
  return record;
}

export async function getSessionRecord(sessionId: string, seed: string): Promise<SessionRecord | null> {
  const key = runtimeKeyFrom(seed, sessionId);
  const result = await backend.get(key);
  return result ?? null;
}

export async function updateSessionSpot(
  sessionId: string,
  seed: string,
  decisionIndex: number,
  spot: Spot
): Promise<SessionRecord> {
  const record = await getSessionRecord(sessionId, seed);
  if (!record) {
    throw new Error("session not found");
  }
  record.decisionIndex = decisionIndex;
  record.currentSpot = spot;
  return record;
}

export async function appendSessionEntry(
  sessionId: string,
  seed: string,
  entry: SessionEntry
): Promise<SessionRecord> {
  const record = await getSessionRecord(sessionId, seed);
  if (!record) {
    throw new Error("session not found");
  }
  record.entries.push(entry);
  return record;
}

export async function clearSessionStore(): Promise<void> {
  await backend.clear();
}

export function setSessionStoreBackend(nextBackend: SessionStoreBackend): void {
  backend = nextBackend;
}
