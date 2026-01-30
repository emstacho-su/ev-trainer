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

const store = new Map<string, SessionRecord>();

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
  const existing = store.get(key);
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
  store.set(key, record);
  return record;
}

export function getSessionRecord(sessionId: string, seed: string): SessionRecord | null {
  const key = runtimeKeyFrom(seed, sessionId);
  return store.get(key) ?? null;
}

export function getSessionRecordById(sessionId: string): SessionRecord | null {
  for (const record of store.values()) {
    if (record.sessionId === sessionId) return record;
  }
  return null;
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
  store.clear();
}
