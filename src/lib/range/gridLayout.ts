// src/lib/range/gridLayout.ts

/**
 * 13x13 grid layout for poker hand matrix.
 * Ranks ordered high to low: A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2
 *
 * Layout convention:
 * - Diagonal: pocket pairs (AA at [0,0], KK at [1,1], ..., 22 at [12,12])
 * - Above diagonal: suited hands (row < col, e.g., AKs at [0,1])
 * - Below diagonal: offsuit hands (row > col, e.g., AKo at [1,0])
 */

export const RANKS = [
  "A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2",
] as const;

export type Rank = (typeof RANKS)[number];

/** Fast rank-to-index lookup. */
export const RANK_INDEX: Record<Rank, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i]),
) as Record<Rank, number>;

/**
 * Maps a canonical hand string to its [row, col] position in the 13x13 grid.
 * Returns null for invalid hands.
 *
 * Examples:
 *  - "AA"  -> [0, 0]  (pair on diagonal)
 *  - "AKs" -> [0, 1]  (suited above diagonal)
 *  - "AKo" -> [1, 0]  (offsuit below diagonal)
 */
export function getGridPosition(hand: string): [number, number] | null {
  if (hand.length < 2 || hand.length > 3) return null;

  const r1 = hand[0] as Rank;
  const r2 = hand[1] as Rank;
  const suffix = hand[2]?.toLowerCase() ?? "";

  const idx1 = RANK_INDEX[r1];
  const idx2 = RANK_INDEX[r2];

  if (idx1 === undefined || idx2 === undefined) return null;

  // Pair: on diagonal
  if (r1 === r2) return [idx1, idx1];

  // Higher rank should be first (lower index)
  const hi = Math.min(idx1, idx2);
  const lo = Math.max(idx1, idx2);

  // Suited: above diagonal (row < col)
  if (suffix === "s") return [hi, lo];

  // Offsuit: below diagonal (row > col)
  return [lo, hi];
}

/**
 * Returns the canonical hand string at a given [row, col] position.
 * Returns null for out-of-bounds positions.
 */
export function getHandAtPosition(row: number, col: number): string | null {
  if (row < 0 || row > 12 || col < 0 || col > 12) return null;

  const r1 = RANKS[row];
  const r2 = RANKS[col];

  // Diagonal: pair
  if (row === col) return `${r1}${r2}`;

  // Above diagonal: suited (row < col means higher rank is row)
  if (row < col) return `${r1}${r2}s`;

  // Below diagonal: offsuit (row > col means higher rank is col)
  return `${r2}${r1}o`;
}
