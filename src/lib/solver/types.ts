// src/lib/solver/types.ts
// Core type definitions for the poker solver module.

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
