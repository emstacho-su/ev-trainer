/**
 * Overview: In-memory app-layer session record store for current run state.
 * Interacts with: session handlers and runtime keying utilities.
 * Importance: Tracks current spot and submitted entries per session.
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
  get(key: string): SessionRecord | undefined;
  set(key: string, value: SessionRecord): void;
  clear(): void;
}

class InMemorySessionStoreBackend implements SessionStoreBackend {
  private readonly store = new Map<string, SessionRecord>();

  get(key: string): SessionRecord | undefined {
    return this.store.get(key);
  }

  set(key: string, value: SessionRecord): void {
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }
}

let backend: SessionStoreBackend = new InMemorySessionStoreBackend();

export function createSessionRecord(input: {
  sessionId: string;
  seed: string;
  mode: SessionMode;
  packId: string;
  filters: SpotFilterInput;
  decisionIndex: number;
  decisionsPerSession: number;
}): SessionRecord {
  const key = runtimeKeyFrom(input.seed, input.sessionId);
  const existing = backend.get(key);
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
  backend.set(key, record);
  return record;
}

export function getSessionRecord(sessionId: string, seed: string): SessionRecord | null {
  const key = runtimeKeyFrom(seed, sessionId);
  return backend.get(key) ?? null;
}

export function updateSessionSpot(
  sessionId: string,
  seed: string,
  decisionIndex: number,
  spot: Spot
): SessionRecord {
  const record = getSessionRecord(sessionId, seed);
  if (!record) {
    throw new Error("session not found");
  }
  record.decisionIndex = decisionIndex;
  record.currentSpot = spot;
  return record;
}

export function appendSessionEntry(
  sessionId: string,
  seed: string,
  entry: SessionEntry
): SessionRecord {
  const record = getSessionRecord(sessionId, seed);
  if (!record) {
    throw new Error("session not found");
  }
  record.entries.push(entry);
  return record;
}

export function clearSessionStore(): void {
  backend.clear();
}

export function setSessionStoreBackend(nextBackend: SessionStoreBackend): void {
  backend = nextBackend;
}
