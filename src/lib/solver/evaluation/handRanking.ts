// src/lib/solver/evaluation/handRanking.ts
// Hand ranking utilities using poker-evaluator-ts.
// Provides hand evaluation and comparison for 5-7 card hands.

import type { Card } from '../types';

// Dynamically import poker-evaluator-ts to handle CommonJS module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PokerEvaluator = require('poker-evaluator-ts');

/**
 * Hand category enumeration.
 * Ordered from weakest to strongest.
 */
export type HandCategory =
  | 'HIGH_CARD'
  | 'PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH';

/**
 * Result of evaluating a poker hand.
 */
export interface HandRank {
  /** Numeric rank for comparison (higher = better) */
  value: number;
  /** Hand category (HIGH_CARD, PAIR, etc.) */
  category: HandCategory;
  /** Human-readable description (e.g., "Pair of Aces") */
  description: string;
}

/**
 * Mapping from poker-evaluator-ts hand type names to our HandCategory.
 * The evaluator returns lowercase strings like "pair", "flush", etc.
 */
const HAND_TYPE_MAP: Record<string, HandCategory> = {
  'high card': 'HIGH_CARD',
  'one pair': 'PAIR',
  'two pairs': 'TWO_PAIR',
  'three of a kind': 'THREE_OF_A_KIND',
  'straight': 'STRAIGHT',
  'flush': 'FLUSH',
  'full house': 'FULL_HOUSE',
  'four of a kind': 'FOUR_OF_A_KIND',
  'straight flush': 'STRAIGHT_FLUSH',
  // Royal flush is detected separately (straight flush with A-high)
};

/**
 * Numeric category values for hand ranking comparison.
 * Higher = better.
 */
const CATEGORY_VALUES: Record<HandCategory, number> = {
  'HIGH_CARD': 1,
  'PAIR': 2,
  'TWO_PAIR': 3,
  'THREE_OF_A_KIND': 4,
  'STRAIGHT': 5,
  'FLUSH': 6,
  'FULL_HOUSE': 7,
  'FOUR_OF_A_KIND': 8,
  'STRAIGHT_FLUSH': 9,
  'ROYAL_FLUSH': 10,
};

/**
 * Evaluates a poker hand and returns its ranking.
 *
 * Accepts 5-7 cards (hole cards + board). For 6-7 cards, returns
 * the best 5-card hand ranking.
 *
 * @param cards - Array of 5-7 cards in "Ah", "Kc" format
 * @returns HandRank with value, category, and description
 * @throws Error if fewer than 5 cards provided
 */
export function evaluateHand(cards: Card[]): HandRank {
  if (cards.length < 5) {
    throw new Error(`evaluateHand requires at least 5 cards, got ${cards.length}`);
  }

  if (cards.length > 7) {
    throw new Error(`evaluateHand accepts at most 7 cards, got ${cards.length}`);
  }

  // Call poker-evaluator-ts
  const result = PokerEvaluator.evalHand(cards);

  // Extract category from result
  const rawHandType = result.handName.toLowerCase();
  let category: HandCategory = HAND_TYPE_MAP[rawHandType] || 'HIGH_CARD';

  // Check for royal flush (A-high straight flush)
  if (category === 'STRAIGHT_FLUSH') {
    // Royal flush has the highest possible value for a straight flush
    // The evaluator's value for royal flush is the max straight flush value
    // We can detect it by checking if it's an A-high straight flush
    if (isRoyalFlush(cards, result)) {
      category = 'ROYAL_FLUSH';
    }
  }

  // Build description
  const description = buildDescription(category, result.handName);

  return {
    value: result.value,
    category,
    description,
  };
}

/**
 * Checks if a straight flush is a royal flush (A-high).
 */
function isRoyalFlush(cards: Card[], result: { value: number; handName: string }): boolean {
  // Royal flush is specifically A-K-Q-J-T suited
  // We can detect it by the hand name or by checking the cards
  const handName = result.handName.toLowerCase();

  // Some evaluators mark it explicitly
  if (handName.includes('royal')) {
    return true;
  }

  // Check if the cards contain A, K, Q, J, T in the same suit
  // For a straight flush to be royal, it must be A-high
  const suits: Record<string, string[]> = { h: [], d: [], c: [], s: [] };

  for (const card of cards) {
    const rank = card[0];
    const suit = card[1] as 'h' | 'd' | 'c' | 's';
    if (suits[suit]) {
      suits[suit].push(rank);
    }
  }

  // Check each suit for royal flush cards
  for (const suitCards of Object.values(suits)) {
    if (suitCards.length >= 5) {
      const hasA = suitCards.includes('A');
      const hasK = suitCards.includes('K');
      const hasQ = suitCards.includes('Q');
      const hasJ = suitCards.includes('J');
      const hasT = suitCards.includes('T');

      if (hasA && hasK && hasQ && hasJ && hasT) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Builds a human-readable description of a hand.
 */
function buildDescription(category: HandCategory, rawHandName: string): string {
  // The evaluator's handName is already descriptive
  // Just capitalize it properly
  return rawHandName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Compares two hands and returns the winner.
 *
 * Both hands are evaluated with the provided board cards.
 * For preflop comparisons without a board, pass an empty board
 * and provide 5 cards minimum in each hand (which isn't typical).
 *
 * @param hand1 - First player's hole cards
 * @param hand2 - Second player's hole cards
 * @param board - Community cards (3-5 cards)
 * @returns 1 if hand1 wins, -1 if hand2 wins, 0 for tie
 * @throws Error if combined cards don't make at least 5 cards
 */
export function compareHands(
  hand1: Card[],
  hand2: Card[],
  board: Card[]
): -1 | 0 | 1 {
  const cards1 = [...hand1, ...board];
  const cards2 = [...hand2, ...board];

  if (cards1.length < 5 || cards2.length < 5) {
    throw new Error(
      `compareHands requires at least 5 cards per hand. ` +
      `Got ${cards1.length} and ${cards2.length} cards.`
    );
  }

  const rank1 = evaluateHand(cards1);
  const rank2 = evaluateHand(cards2);

  if (rank1.value > rank2.value) {
    return 1;
  } else if (rank1.value < rank2.value) {
    return -1;
  }
  return 0;
}

/**
 * Gets the hand category from a HandRank.
 *
 * @param rank - The HandRank to get category from
 * @returns The HandCategory
 */
export function getHandCategory(rank: HandRank): HandCategory {
  return rank.category;
}

/**
 * Gets a numeric value for a hand category.
 * Higher = better category.
 *
 * @param category - The hand category
 * @returns Numeric value (1-10)
 */
export function getCategoryValue(category: HandCategory): number {
  return CATEGORY_VALUES[category];
}

/**
 * Checks if one hand category beats another.
 *
 * @param category1 - First category
 * @param category2 - Second category
 * @returns true if category1 is strictly better than category2
 */
export function categoryBeats(category1: HandCategory, category2: HandCategory): boolean {
  return CATEGORY_VALUES[category1] > CATEGORY_VALUES[category2];
}
