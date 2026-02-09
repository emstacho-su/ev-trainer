// src/lib/solver/evaluation/equity.ts
// Preflop equity calculation utilities for poker solver.

import type { Hand, CanonicalHand, Card, Rank, Suit } from '../types';
import { RANKS, SUITS } from '../types';
import { canonicalizePreflop, getAllCombosForCanonical, CANONICAL_HANDS } from '../abstraction/cards';

// Dynamically import poker-evaluator-ts to handle CommonJS module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PokerEvaluator = require('poker-evaluator-ts');

/**
 * Number of canonical preflop hands (169 = 13 pairs + 78 suited + 78 offsuit).
 */
export const NUM_CANONICAL_HANDS = 169;

/**
 * Preflop equity table: 169x169 Float64Array storing equity values.
 * Access via getEquityIndex for proper symmetry handling.
 *
 * Not exported directly - use calculatePreflopEquityFromTable() instead.
 */
let PREFLOP_EQUITY_TABLE: Float64Array | null = null;

/**
 * Gets the index into the equity table for a hand pair.
 * Always returns canonical order (lower index first) for symmetry.
 *
 * @param canonical1 - First canonical hand
 * @param canonical2 - Second canonical hand
 * @returns Object with index and whether order was swapped
 */
export function getEquityIndex(
  canonical1: CanonicalHand,
  canonical2: CanonicalHand
): { index: number; swapped: boolean } {
  const idx1 = CANONICAL_HANDS.indexOf(canonical1);
  const idx2 = CANONICAL_HANDS.indexOf(canonical2);

  if (idx1 === -1 || idx2 === -1) {
    throw new Error(`Invalid canonical hand: ${idx1 === -1 ? canonical1 : canonical2}`);
  }

  // Always store with lower index first (upper triangle)
  if (idx1 <= idx2) {
    return { index: idx1 * NUM_CANONICAL_HANDS + idx2, swapped: false };
  }
  return { index: idx2 * NUM_CANONICAL_HANDS + idx1, swapped: true };
}

/**
 * Builds a full 52-card deck.
 */
function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }
  return deck;
}

/**
 * Converts our card format to poker-evaluator format.
 * Our format: "Ah", "Kc", etc.
 * Evaluator format: "Ah", "Kc", etc. (same format, but needs uppercase rank)
 */
function toEvaluatorCard(card: Card): string {
  // poker-evaluator-ts uses same format but may be case-sensitive
  return card;
}

/**
 * Evaluates a 7-card hand and returns its strength value.
 * Higher value = stronger hand.
 */
function evaluateHand(cards: string[]): number {
  const result = PokerEvaluator.evalHand(cards);
  return result.value;
}

/**
 * Calculates preflop equity using Monte Carlo simulation.
 *
 * Runs specified iterations of random 5-card boards and determines
 * win/tie/loss outcomes to compute equity for hand1.
 *
 * @param hand1 - First player's hand [Card, Card]
 * @param hand2 - Second player's hand [Card, Card]
 * @param iterations - Number of random boards to simulate (default 10000)
 * @returns Equity for hand1 (0.0 to 1.0)
 */
export function calculatePreflopEquityMonteCarlo(
  hand1: Hand,
  hand2: Hand,
  iterations: number = 10000
): number {
  // Validate no card overlap
  const usedCards = new Set([hand1[0], hand1[1], hand2[0], hand2[1]]);
  if (usedCards.size !== 4) {
    throw new Error('Hands share cards - invalid comparison');
  }

  // Build deck minus the 4 hole cards
  const deck = buildDeck().filter(card => !usedCards.has(card));

  let wins = 0;
  let ties = 0;

  for (let i = 0; i < iterations; i++) {
    // Fisher-Yates shuffle for first 5 cards (board)
    const shuffled = [...deck];
    for (let j = 0; j < 5; j++) {
      const k = j + Math.floor(Math.random() * (shuffled.length - j));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }
    const board = shuffled.slice(0, 5);

    // Evaluate both hands
    const cards1 = [
      toEvaluatorCard(hand1[0]),
      toEvaluatorCard(hand1[1]),
      ...board.map(toEvaluatorCard),
    ];
    const cards2 = [
      toEvaluatorCard(hand2[0]),
      toEvaluatorCard(hand2[1]),
      ...board.map(toEvaluatorCard),
    ];

    const value1 = evaluateHand(cards1);
    const value2 = evaluateHand(cards2);

    if (value1 > value2) {
      wins++;
    } else if (value1 === value2) {
      ties++;
    }
  }

  // Equity = P(win) + 0.5 * P(tie)
  return (wins + 0.5 * ties) / iterations;
}

/**
 * Calculates preflop equity from a precomputed table.
 * O(1) lookup for fast solver iterations.
 *
 * @param canonical1 - First player's canonical hand
 * @param canonical2 - Second player's canonical hand
 * @returns Equity for hand1 (0.0 to 1.0)
 * @throws Error if equity table not loaded
 */
export function calculatePreflopEquityFromTable(
  canonical1: CanonicalHand,
  canonical2: CanonicalHand
): number {
  if (!PREFLOP_EQUITY_TABLE) {
    throw new Error('Preflop equity table not loaded. Call loadPreflopEquityTable first.');
  }

  // Same hand has 50% equity (can't actually happen in real game)
  if (canonical1 === canonical2) {
    return 0.5;
  }

  const { index, swapped } = getEquityIndex(canonical1, canonical2);
  const equity = PREFLOP_EQUITY_TABLE[index];

  // If swapped, return 1 - equity (symmetric)
  return swapped ? 1 - equity : equity;
}

/**
 * Calculates preflop equity between two canonical hands.
 * Uses Monte Carlo simulation weighted by unblocked combinations.
 *
 * This handles card removal: not all combos of each canonical hand
 * can exist together due to card blockers.
 *
 * @param canonical1 - First player's canonical hand
 * @param canonical2 - Second player's canonical hand
 * @param iterationsPerMatchup - Monte Carlo iterations per combo pair
 * @returns Weighted average equity for hand1
 */
export function calculateCanonicalEquity(
  canonical1: CanonicalHand,
  canonical2: CanonicalHand,
  iterationsPerMatchup: number = 1000
): number {
  // Same canonical hand - can still have non-blocking combos (e.g., AhKh vs AcKc for AKs)
  // But typically treated as 50% for self-play
  if (canonical1 === canonical2) {
    return 0.5;
  }

  const combos1 = getAllCombosForCanonical(canonical1);
  const combos2 = getAllCombosForCanonical(canonical2);

  let totalEquity = 0;
  let totalWeight = 0;

  for (const h1 of combos1) {
    for (const h2 of combos2) {
      // Skip if cards overlap (blocked)
      const cards = new Set([h1[0], h1[1], h2[0], h2[1]]);
      if (cards.size !== 4) {
        continue;
      }

      // Calculate equity for this specific combo matchup
      const equity = calculatePreflopEquityMonteCarlo(h1, h2, iterationsPerMatchup);
      totalEquity += equity;
      totalWeight++;
    }
  }

  if (totalWeight === 0) {
    // Completely blocked (shouldn't happen for different canonical hands)
    return 0.5;
  }

  return totalEquity / totalWeight;
}

/**
 * Sets the preflop equity table (used by loadPreflopEquityTable).
 */
export function setPreflopEquityTable(table: Float64Array): void {
  if (table.length !== NUM_CANONICAL_HANDS * NUM_CANONICAL_HANDS) {
    throw new Error(
      `Invalid equity table size: ${table.length}, expected ${NUM_CANONICAL_HANDS * NUM_CANONICAL_HANDS}`
    );
  }
  PREFLOP_EQUITY_TABLE = table;
}

/**
 * Checks if the preflop equity table is loaded.
 */
export function isEquityTableLoaded(): boolean {
  return PREFLOP_EQUITY_TABLE !== null;
}

/**
 * Clears the preflop equity table (for testing).
 */
export function clearEquityTable(): void {
  PREFLOP_EQUITY_TABLE = null;
}

/**
 * Gets the raw equity table (for saving/debugging).
 */
export function getEquityTable(): Float64Array | null {
  return PREFLOP_EQUITY_TABLE;
}
