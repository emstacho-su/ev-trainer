// src/lib/engine/decisionStore.ts

import type { DecisionRecord, DecisionStore, TrainingMode } from "./trainingOrchestrator";

export type ReviewSort = "evLossVsMixDesc" | "createdAtDesc";

export interface ReviewListOptions {
  sessionId?: string;
  modes?: TrainingMode[];
  sort?: ReviewSort;
  offset?: number;
  limit?: number;
}

export interface DecisionRecordStore extends DecisionStore {
  list(options?: ReviewListOptions): DecisionRecord[];
  get(id: string): DecisionRecord | undefined;
}

function compareByEvLoss(a: DecisionRecord, b: DecisionRecord): number {
  const diff = b.grade.evLossVsMix - a.grade.evLossVsMix;
  if (diff !== 0) return diff;
  if (a.createdAt === b.createdAt) {
    return a.id.localeCompare(b.id);
  }
  return b.createdAt.localeCompare(a.createdAt);
}

function compareByCreatedAt(a: DecisionRecord, b: DecisionRecord): number {
  if (a.createdAt === b.createdAt) {
    return a.id.localeCompare(b.id);
  }
  return b.createdAt.localeCompare(a.createdAt);
}

export class MemoryDecisionStore implements DecisionRecordStore {
  private records: DecisionRecord[] = [];

  add(record: DecisionRecord): void {
    this.records.push(record);
  }

  list(options?: ReviewListOptions): DecisionRecord[] {
    const { sessionId, modes, sort, offset, limit } = options ?? {};
    let filtered = this.records;

    if (sessionId) {
      filtered = filtered.filter((record) => record.sessionId === sessionId);
    }
    if (modes && modes.length > 0) {
      const allowed = new Set(modes);
      filtered = filtered.filter((record) => allowed.has(record.mode));
    }

    const sorted = [...filtered].sort(sort === "createdAtDesc" ? compareByCreatedAt : compareByEvLoss);

    const start = offset && offset > 0 ? offset : 0;
    const end = limit && limit > 0 ? start + limit : undefined;
    return sorted.slice(start, end);
  }

  get(id: string): DecisionRecord | undefined {
    return this.records.find((record) => record.id === id);
  }
}
