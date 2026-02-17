// src/lib/range/rangeHelpers.ts

import type { ActionFrequency, EquityCategory, RangeActionType } from "./types";

const RANK_ORDER = "AKQJT98765432";

/**
 * Normalize a hand string to canonical form.
 * - Pairs: "AA" (no suit suffix)
 * - Non-pairs: higher rank first, with "s" or "o" suffix
 * Examples: "KAs" -> "AKs", "9Ts" -> "T9s", "aa" -> "AA"
 */
export function normalizeHandString(hand: string): string {
  const upper = hand.toUpperCase().trim();

  if (upper.length < 2 || upper.length > 3) return upper;

  const rank1 = upper[0];
  const rank2 = upper[1];
  const suffix = upper.length === 3 ? upper[2].toLowerCase() : "";

  const idx1 = RANK_ORDER.indexOf(rank1);
  const idx2 = RANK_ORDER.indexOf(rank2);

  if (idx1 === -1 || idx2 === -1) return upper;

  // Pairs: no suffix needed
  if (rank1 === rank2) return `${rank1}${rank2}`;

  // Non-pairs: higher rank first
  if (idx1 < idx2) {
    return `${rank1}${rank2}${suffix === "s" ? "s" : "o"}`;
  }
  return `${rank2}${rank1}${suffix === "s" ? "s" : "o"}`;
}

/**
 * Categorize a hand string by equity/structure.
 */
export function categorizeHandStrength(hand: string): EquityCategory {
  const normalized = normalizeHandString(hand);
  const rank1 = normalized[0];
  const rank2 = normalized[1];
  const suffix = normalized[2] ?? "";

  // Pairs
  if (rank1 === rank2) {
    const idx = RANK_ORDER.indexOf(rank1);
    if (idx <= 3) return "premium-pairs"; // AA, KK, QQ, JJ
    if (idx <= 6) return "medium-pairs"; // TT, 99, 88
    return "small-pairs"; // 77-22
  }

  // Broadway (both ranks T or higher)
  const idx1 = RANK_ORDER.indexOf(rank1);
  const idx2 = RANK_ORDER.indexOf(rank2);
  if (idx1 <= 4 && idx2 <= 4) return "broadway";

  // Suited hands
  if (suffix === "s") {
    const gap = idx2 - idx1;
    if (gap === 1) return "suited-connectors";
    return "suited-gappers";
  }

  return "offsuit";
}

/**
 * Normalize action frequencies so they sum to exactly 1.0.
 * Handles floating-point rounding errors.
 * Filters out zero-frequency actions.
 */
export function normalizeActionFrequencies(
  actions: ActionFrequency[],
): ActionFrequency[] {
  // Filter out zero-frequency actions
  const nonZero = actions.filter((a) => a.frequency > 0);
  if (nonZero.length === 0) return [];

  const total = nonZero.reduce((sum, a) => sum + a.frequency, 0);

  // Already sums to 1.0 (within tolerance)
  if (Math.abs(total - 1.0) < 1e-9) return nonZero;

  // Scale to sum to 1.0
  return nonZero.map((a) => ({
    type: a.type as RangeActionType,
    frequency: a.frequency / total,
  }));
}
