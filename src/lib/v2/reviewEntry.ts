/**
 * Overview: Normalizes review entry EV-loss reading and best-action checks.
 * Interacts with: review UI and aggregate calculators.
 * Importance: Keeps EV-based review semantics consistent across surfaces.
 */

export interface ReviewEntryGradeLike {
  grade?: {
    evLossVsBest?: number;
  };
  result?: {
    evLossVsBest?: number;
  };
}

const BEST_ACTION_EPSILON = 1e-9;

function toFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readEvLossVsBest(entry: ReviewEntryGradeLike): number {
  const fromGrade = toFinite(entry.grade?.evLossVsBest);
  if (fromGrade !== null) return fromGrade;
  const fromResult = toFinite(entry.result?.evLossVsBest);
  if (fromResult !== null) return fromResult;
  return 0;
}

export function isBestActionFromEvLoss(evLossVsBest: number): boolean {
  return evLossVsBest <= BEST_ACTION_EPSILON;
}
