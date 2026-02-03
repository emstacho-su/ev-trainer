/**
 * Overview: Computes global totals and bucketed breakdowns across sessions.
 * Interacts with: session aggregate fallback logic and stack bucket helpers.
 * Importance: Powers cross-session analytics and prioritization views.
 */

import { computeSessionAggregates } from "./sessionAggregates";
import { bucketEffectiveStackBb } from "../v2/filters/spotFilters";
import { isBestActionFromEvLoss, readEvLossVsBest, type ReviewEntryGradeLike } from "../v2/reviewEntry";

const UNKNOWN_BUCKET = "unknown";

interface TotalsAccumulator {
  decisions: number;
  evLossSum: number;
  bestActionCount: number;
}

export interface GlobalStatsTotals {
  totalSessions: number;
  totalDecisions: number;
  meanEvLoss: number;
  bestActionRate: number;
}

export interface GlobalStatsBreakdownRow {
  bucket: string;
  decisions: number;
  meanEvLoss: number;
  bestActionRate: number;
}

export interface GlobalStatsResult {
  totals: GlobalStatsTotals;
  breakdowns: {
    byStreet: GlobalStatsBreakdownRow[];
    byPotType: GlobalStatsBreakdownRow[];
    byStackBucket: GlobalStatsBreakdownRow[];
  };
}

interface PersistedEntryLike extends ReviewEntryGradeLike {
  spot?: {
    street?: unknown;
    potType?: unknown;
    effectiveStackBb?: unknown;
  };
}

interface PersistedSessionLike {
  session?: {
    isComplete?: unknown;
    filters?: {
      street?: unknown;
      potType?: unknown;
      effectiveStackBbBucket?: unknown;
    };
  };
  completedAt?: unknown;
  aggregates?: {
    volume?: unknown;
    meanEvLoss?: unknown;
    bestActionRate?: unknown;
  };
  entries?: unknown;
}

function emptyTotals(): TotalsAccumulator {
  return { decisions: 0, evLossSum: 0, bestActionCount: 0 };
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function toBucketLabel(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) return UNKNOWN_BUCKET;
  return value.trim();
}

function isRecordLike(value: unknown): value is PersistedSessionLike {
  return typeof value === "object" && value !== null;
}

function isCompletedSession(record: PersistedSessionLike): boolean {
  if (typeof record.completedAt === "string" && record.completedAt.trim().length > 0) {
    return true;
  }
  return record.session?.isComplete === true;
}

function normalizeEntries(value: unknown): PersistedEntryLike[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is PersistedEntryLike =>
      typeof entry === "object" && entry !== null
  );
}

function readAggregateSnapshot(record: PersistedSessionLike): {
  volume: number;
  meanEvLoss: number;
  bestActionRate: number;
} | null {
  const volume = toFiniteNumber(record.aggregates?.volume);
  const meanEvLoss = toFiniteNumber(record.aggregates?.meanEvLoss);
  const bestActionRate = toFiniteNumber(record.aggregates?.bestActionRate);
  if (volume === null || meanEvLoss === null || bestActionRate === null || volume < 0) {
    return null;
  }
  return { volume, meanEvLoss, bestActionRate };
}

function resolveStackBucketFromEntry(entry: PersistedEntryLike): string {
  const stackBb = toFiniteNumber(entry.spot?.effectiveStackBb);
  if (stackBb === null || stackBb < 0) return UNKNOWN_BUCKET;
  return bucketEffectiveStackBb(stackBb);
}

function readSessionFilterBucket(
  record: PersistedSessionLike,
  key: "street" | "potType" | "effectiveStackBbBucket"
): string {
  return toBucketLabel(record.session?.filters?.[key]);
}

function addWeightedTotals(
  target: TotalsAccumulator,
  volume: number,
  meanEvLoss: number,
  bestActionRate: number
): void {
  if (volume <= 0) return;
  target.decisions += volume;
  target.evLossSum += meanEvLoss * volume;
  target.bestActionCount += bestActionRate * volume;
}

function addDecision(
  target: TotalsAccumulator,
  entry: ReviewEntryGradeLike
): void {
  const evLoss = readEvLossVsBest(entry);
  target.decisions += 1;
  target.evLossSum += evLoss;
  if (isBestActionFromEvLoss(evLoss)) {
    target.bestActionCount += 1;
  }
}

function upsertBucket(
  map: Map<string, TotalsAccumulator>,
  bucket: string
): TotalsAccumulator {
  const normalizedBucket = toBucketLabel(bucket);
  const existing = map.get(normalizedBucket);
  if (existing) return existing;
  const created = emptyTotals();
  map.set(normalizedBucket, created);
  return created;
}

function toBreakdownRows(
  map: Map<string, TotalsAccumulator>
): GlobalStatsBreakdownRow[] {
  return [...map.entries()]
    .map(([bucket, totals]) => ({
      bucket,
      decisions: totals.decisions,
      meanEvLoss: totals.decisions > 0 ? totals.evLossSum / totals.decisions : 0,
      bestActionRate:
        totals.decisions > 0 ? totals.bestActionCount / totals.decisions : 0,
    }))
    .sort((a, b) => b.decisions - a.decisions || a.bucket.localeCompare(b.bucket));
}

export function createZeroGlobalStats(): GlobalStatsResult {
  return {
    totals: {
      totalSessions: 0,
      totalDecisions: 0,
      meanEvLoss: 0,
      bestActionRate: 0,
    },
    breakdowns: {
      byStreet: [],
      byPotType: [],
      byStackBucket: [],
    },
  };
}

export function computeGlobalStats(records: readonly unknown[]): GlobalStatsResult {
  const totals = emptyTotals();
  let totalSessions = 0;
  const street = new Map<string, TotalsAccumulator>();
  const potType = new Map<string, TotalsAccumulator>();
  const stack = new Map<string, TotalsAccumulator>();

  for (const recordValue of records) {
    if (!isRecordLike(recordValue)) continue;
    if (!isCompletedSession(recordValue)) continue;

    const entries = normalizeEntries(recordValue.entries);
    const aggregate =
      readAggregateSnapshot(recordValue) ??
      (entries.length > 0 ? computeSessionAggregates(entries) : null);
    if (!aggregate) continue;

    totalSessions += 1;
    addWeightedTotals(
      totals,
      aggregate.volume,
      aggregate.meanEvLoss,
      aggregate.bestActionRate
    );

    if (entries.length > 0) {
      for (const entry of entries) {
        addDecision(upsertBucket(street, toBucketLabel(entry.spot?.street)), entry);
        addDecision(upsertBucket(potType, toBucketLabel(entry.spot?.potType)), entry);
        addDecision(upsertBucket(stack, resolveStackBucketFromEntry(entry)), entry);
      }
      continue;
    }

    addWeightedTotals(
      upsertBucket(street, readSessionFilterBucket(recordValue, "street")),
      aggregate.volume,
      aggregate.meanEvLoss,
      aggregate.bestActionRate
    );
    addWeightedTotals(
      upsertBucket(potType, readSessionFilterBucket(recordValue, "potType")),
      aggregate.volume,
      aggregate.meanEvLoss,
      aggregate.bestActionRate
    );
    addWeightedTotals(
      upsertBucket(
        stack,
        readSessionFilterBucket(recordValue, "effectiveStackBbBucket")
      ),
      aggregate.volume,
      aggregate.meanEvLoss,
      aggregate.bestActionRate
    );
  }

  return {
    totals: {
      totalSessions,
      totalDecisions: totals.decisions,
      meanEvLoss: totals.decisions > 0 ? totals.evLossSum / totals.decisions : 0,
      bestActionRate:
        totals.decisions > 0 ? totals.bestActionCount / totals.decisions : 0,
    },
    breakdowns: {
      byStreet: toBreakdownRows(street),
      byPotType: toBreakdownRows(potType),
      byStackBucket: toBreakdownRows(stack),
    },
  };
}
