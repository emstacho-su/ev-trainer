// src/lib/solver/abstraction/cards.ts
// Preflop card abstraction: maps 1326 possible hands to 169 canonical hands.

import type { Card, Hand, CanonicalHand, HandCategory } from '../types';
import { RANKS, SUITS } from '../types';
import {
  getRankValue,
  parseCard,
  getSuitedStatus,
  getNormalizedRanks,
} from './isomorphism';

/**
 * All 169 canonical preflop hands in standard order:
 * - 13 pairs (AA, KK, ... 22)
 * - 78 suited hands (AKs, AQs, ... 32s)
 * - 78 offsuit hands (AKo, AQo, ... 32o)
 */
export const CANONICAL_HANDS: CanonicalHand[] = buildCanonicalHandsList();

/**
 * Builds the list of all 169 canonical hands.
 * Order: Pairs first (AA-22), then for each high rank,
 * suited combos with lower ranks, then offsuit combos with lower ranks.
 */
function buildCanonicalHandsList(): CanonicalHand[] {
  const hands: CanonicalHand[] = [];

  // Add pairs first (13 total)
  for (const rank of RANKS) {
    hands.push(`${rank}${rank}`);
  }

  // Add suited and offsuit combos
  // For each high rank, pair with all lower ranks
  for (let i = 0; i < RANKS.length; i++) {
    const highRank = RANKS[i];
    for (let j = i + 1; j < RANKS.length; j++) {
      const lowRank = RANKS[j];
      hands.push(`${highRank}${lowRank}s`); // Suited
    }
    for (let j = i + 1; j < RANKS.length; j++) {
      const lowRank = RANKS[j];
      hands.push(`${highRank}${lowRank}o`); // Offsuit
    }
  }

  return hands;
}

/**
 * Converts a two-card hand to its canonical preflop representation.
 * Examples:
 * - ['Ah', 'Kh'] -> 'AKs' (suited)
 * - ['As', 'Kd'] -> 'AKo' (offsuit)
 * - ['Ah', 'Ad'] -> 'AA' (pair)
 *
 * Pure and deterministic for reproducibility.
 */
export function canonicalizePreflop(card1: Card, card2: Card): CanonicalHand {
  const hand: Hand = [card1, card2];
  const [highRank, lowRank] = getNormalizedRanks(hand);
  const category = getSuitedStatus(hand);

  switch (category) {
    case 'pair':
      return `${highRank}${lowRank}`;
    case 'suited':
      return `${highRank}${lowRank}s`;
    case 'offsuit':
      return `${highRank}${lowRank}o`;
  }
}

/**
 * Builds a mapping from canonical hand strings to bucket IDs (0-168).
 * Used for efficient array indexing in info set storage.
 */
export function buildPreflopAbstraction(): Map<CanonicalHand, number> {
  const map = new Map<CanonicalHand, number>();
  for (let i = 0; i < CANONICAL_HANDS.length; i++) {
    map.set(CANONICAL_HANDS[i], i);
  }
  return map;
}

/**
 * Returns all actual card combinations for a canonical hand.
 * - Pairs: 6 combos (C(4,2) = 6)
 * - Suited: 4 combos (one per suit)
 * - Offsuit: 12 combos (4 * 3)
 */
export function getAllCombosForCanonical(canonical: CanonicalHand): Hand[] {
  const combos: Hand[] = [];

  // Parse the canonical hand format
  if (canonical.length === 2) {
    // Pair: "AA", "KK", etc.
    const rank = canonical[0] as typeof RANKS[number];
    // Generate all 6 combinations of 4 suits taken 2 at a time
    for (let i = 0; i < SUITS.length; i++) {
      for (let j = i + 1; j < SUITS.length; j++) {
        combos.push([`${rank}${SUITS[i]}`, `${rank}${SUITS[j]}`] as Hand);
      }
    }
  } else if (canonical.length === 3) {
    const highRank = canonical[0] as typeof RANKS[number];
    const lowRank = canonical[1] as typeof RANKS[number];
    const suffix = canonical[2];

    if (suffix === 's') {
      // Suited: 4 combos (one per suit)
      for (const suit of SUITS) {
        combos.push([`${highRank}${suit}`, `${lowRank}${suit}`] as Hand);
      }
    } else if (suffix === 'o') {
      // Offsuit: 12 combos (4 * 3)
      for (const suit1 of SUITS) {
        for (const suit2 of SUITS) {
          if (suit1 !== suit2) {
            combos.push([`${highRank}${suit1}`, `${lowRank}${suit2}`] as Hand);
          }
        }
      }
    }
  }

  return combos;
}

/**
 * Gets the category of a canonical hand.
 */
export function getCanonicalCategory(canonical: CanonicalHand): HandCategory {
  if (canonical.length === 2) {
    return 'pair';
  }
  if (canonical[2] === 's') {
    return 'suited';
  }
  return 'offsuit';
}

/**
 * Generates all 1326 possible preflop hands.
 * Useful for testing and enumeration.
 */
export function generateAllHands(): Hand[] {
  const hands: Hand[] = [];
  const deck: Card[] = [];

  // Build the deck
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }

  // Generate all 2-card combinations (52 choose 2 = 1326)
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      hands.push([deck[i], deck[j]]);
    }
  }

  return hands;
}

/**
 * Gets the bucket ID for a hand.
 * Returns undefined if the hand doesn't map to a valid canonical form.
 */
export function getBucketId(card1: Card, card2: Card): number | undefined {
  const canonical = canonicalizePreflop(card1, card2);
  const abstraction = buildPreflopAbstraction();
  return abstraction.get(canonical);
}

// ── Postflop stubs ────────────────────────────────────────────────────
// These exports are referenced by postflopSolver.ts but not yet implemented.
// Stubbed here to unblock the build. Real implementations will come when
// the full postflop solver replaces the mock solver.

/** Default number of postflop equity buckets. */
export const DEFAULT_POSTFLOP_BUCKETS = 50;

/** A postflop bucket is an integer index into the bucketed equity range. */
export type PostflopBucket = number;

/** Get valid hands excluding cards on the board. */
export function getValidHands(_board?: Card[]): Hand[] {
  return generateAllHands();
}

/** Calculate expected hand strength (Monte Carlo). Stub returns 0.5. */
export function calculateEHS(_hand: Hand, _board: Card[], _iterations?: number): number {
  return 0.5;
}

/** Assign a hand to an equity bucket. Stub returns bucket 0. */
export function assignBucket(_ehs: number, _buckets?: PostflopBucket[] | number): PostflopBucket {
  return 0;
}

/** Get postflop bucket boundaries. Stub returns empty array. */
export function getPostflopBuckets(_numBuckets?: number): number[] {
  return [];
}

/** Build a postflop info set ID from player, bucket, board, and history. */
export function buildPostflopInfoSetId(
  player: number,
  bucket: PostflopBucket,
  board: string | readonly string[],
  history: string | readonly string[],
): string {
  const boardStr = Array.isArray(board) ? board.join('') : board;
  const historyStr = Array.isArray(history) ? history.join(',') : history;
  return `${player}:B${bucket}:${boardStr}:${historyStr}`;
}
