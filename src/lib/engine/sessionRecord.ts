// src/lib/engine/sessionRecord.ts

import type { ActionId } from "./types";
import type { DecisionGrade, DecisionMetrics, GradeDecision, TrainingMode } from "./trainingOrchestrator";
import type { CanonicalNode } from "./nodeTypes";
import type { SolverNodeOutput } from "./solverAdapter";
import type { Spot } from "./spot";

export const SessionRecordSchemaVersion = "1" as const;
export type SessionRecordSchemaVersion = typeof SessionRecordSchemaVersion;

export interface SessionEntry {
  recordId: string;
  nodeHash?: string;
  spotId?: string;
  node?: CanonicalNode;
  spot?: Spot;
  userActionId: ActionId;
  grade: DecisionGrade;
  metrics: DecisionMetrics;
  output?: SolverNodeOutput;
  timings?: {
    solverMs?: number;
    totalMs?: number;
  };
  createdAt?: string;
}

export interface SessionRecord {
  schemaVersion: SessionRecordSchemaVersion;
  sessionId: string;
  seed: string;
  mode: TrainingMode;
  startedAt: string;
  endedAt?: string;
  entries: SessionEntry[];
}

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertFiniteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function validateEntry(entry: SessionEntry, index: number): void {
  if (entry === null || typeof entry !== "object") {
    throw new Error(`entries[${index}] must be an object`);
  }
  assertNonEmptyString(entry.recordId, `entries[${index}].recordId`);
  assertNonEmptyString(entry.userActionId, `entries[${index}].userActionId`);
  assertFiniteNumber(entry.metrics.evUser, `entries[${index}].metrics.evUser`);
  assertFiniteNumber(entry.metrics.evMix, `entries[${index}].metrics.evMix`);
  assertFiniteNumber(entry.metrics.evBest, `entries[${index}].metrics.evBest`);
  assertFiniteNumber(entry.metrics.evLossVsMix, `entries[${index}].metrics.evLossVsMix`);
  assertFiniteNumber(entry.metrics.evLossVsBest, `entries[${index}].metrics.evLossVsBest`);
}

// Validates SessionRecord structure and schema version.
export function validateSessionRecord(record: SessionRecord): SessionRecord {
  if (record === null || typeof record !== "object") {
    throw new Error("session record must be an object");
  }
  if (record.schemaVersion !== SessionRecordSchemaVersion) {
    throw new Error(`session record schemaVersion must be '${SessionRecordSchemaVersion}'`);
  }
  assertNonEmptyString(record.sessionId, "sessionId");
  assertNonEmptyString(record.seed, "seed");
  assertNonEmptyString(record.mode, "mode");
  assertNonEmptyString(record.startedAt, "startedAt");
  if (!Array.isArray(record.entries)) {
    throw new Error("entries must be an array");
  }
  record.entries.forEach((entry, index) => validateEntry(entry, index));
  return record;
}

// Serializes a SessionRecord to JSON.
export function serializeSession(record: SessionRecord): string {
  validateSessionRecord(record);
  return JSON.stringify(record);
}

// Parses and validates a SessionRecord from JSON.
export function deserializeSession(raw: string): SessionRecord {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error("raw session record must be a non-empty string");
  }
  const parsed = JSON.parse(raw) as SessionRecord;
  return validateSessionRecord(parsed);
}

// Replays a recorded entry using a solver and grading function.
export function replayEntry(
  entry: SessionEntry,
  deps: { solve: (node: CanonicalNode) => SolverNodeOutput; gradeDecision: GradeDecision }
): DecisionGrade {
  if (!entry.node) {
    throw new Error("entry.node is required for replay");
  }
  const output = deps.solve(entry.node);
  return deps.gradeDecision(output, entry.userActionId);
}
