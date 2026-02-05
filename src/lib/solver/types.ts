// src/lib/solver/types.ts
// Core type definitions for the poker solver module.

import type { Street } from '../engine/types';

// Re-export Street for convenience
export type { Street } from '../engine/types';

/**
 * Position relative to button for sizing decisions.
 * IP = In Position (acts last postflop)
 * OOP = Out of Position (acts first postflop)
 */
export type PositionRelative = 'IP' | 'OOP';

/**
 * Configuration for computing bet sizes at a specific decision point.
 */
export interface BetSizeConfig {
  /** Current street */
  readonly street: Street;
  /** Player's relative position */
  readonly position: PositionRelative;
  /** Current pot size in big blinds */
  readonly potBb: number;
  /** Effective stack size in big blinds */
  readonly stackBb: number;
  /** Bet amount player is facing, for raise calculations */
  readonly facingBetBb?: number;
}

/**
 * Configuration for action abstraction across the game tree.
 */
export interface ActionAbstractionConfig {
  /** Bet sizes as fractions of pot per street (e.g., 0.33, 0.50, 0.75, 1.0) */
  readonly betSizes: Record<Street, number[]>;
  /** Raise sizes as multiples of facing bet per street (e.g., 2.2, 2.5, 3.0) */
  readonly raiseSizes: Record<Street, number[]>;
  /** Whether to automatically include all-in when stack is shallow */
  readonly includeAllIn: boolean;
  /** Stack/pot ratio below which to add all-in as an option */
  readonly allInThreshold: number;
}

/**
 * Abstracted action representation for solver.
 * Each action has a type and associated amount information.
 */
export type AbstractedAction =
  | { readonly type: 'FOLD' }
  | { readonly type: 'CHECK' }
  | { readonly type: 'CALL'; readonly amountBb: number }
  | { readonly type: 'BET'; readonly amountBb: number; readonly potFraction: number }
  | { readonly type: 'RAISE'; readonly amountBb: number; readonly raiseMultiple: number }
  | { readonly type: 'ALL_IN'; readonly amountBb: number };

/**
 * Card ranks from highest to lowest.
 * A=Ace, K=King, Q=Queen, J=Jack, T=Ten, then 9-2.
 */
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type Rank = (typeof RANKS)[number];

/**
 * Card suits.
 * h=hearts, d=diamonds, c=clubs, s=spades
 */
export const SUITS = ['h', 'd', 'c', 's'] as const;
export type Suit = (typeof SUITS)[number];

/**
 * A card is represented as a two-character string: rank + suit.
 * Examples: "Ah" (Ace of hearts), "Kc" (King of clubs), "2s" (Two of spades)
 */
export type Card = `${Rank}${Suit}`;

/**
 * A hand is a tuple of exactly two cards.
 * Order matters for internal processing but canonical forms normalize order.
 */
export type Hand = [Card, Card];

/**
 * Canonical hand representation for preflop abstraction.
 * Format:
 * - Pairs: "AA", "KK", ..., "22"
 * - Suited: "AKs", "AQs", ..., "32s"
 * - Offsuit: "AKo", "AQo", ..., "32o"
 */
export type CanonicalHand = string;

/**
 * Mapping of original suits to canonical suits.
 * Used for tracking how suits were remapped during canonicalization.
 */
export interface SuitMapping {
  readonly original: readonly [Suit, Suit];
  readonly canonical: readonly [Suit, Suit];
}

/**
 * Hand category for classification.
 */
export type HandCategory = 'pair' | 'suited' | 'offsuit';

/**
 * Result of canonicalizing a hand, including the mapping used.
 */
export interface CanonicalizeResult {
  readonly canonical: CanonicalHand;
  readonly category: HandCategory;
  readonly suitMapping: SuitMapping;
}
