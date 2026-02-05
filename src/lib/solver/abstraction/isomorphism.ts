// src/lib/solver/abstraction/isomorphism.ts
// Suit isomorphism utilities based on Waugh 2013 algorithm.
// Maps strategically equivalent hands to the same canonical form.

import type { Card, Hand, Rank, Suit, HandCategory } from '../types';
import { RANKS } from '../types';

/**
 * Returns the numeric value of a rank (0-12 where A=0, K=1, ... 2=12).
 * Lower values indicate higher ranks.
 */
export function getRankValue(rank: Rank): number {
  const index = RANKS.indexOf(rank);
  if (index === -1) {
    throw new Error(`Invalid rank: ${rank}`);
  }
  return index;
}

/**
 * Extracts rank and suit from a card string.
 */
export function parseCard(card: Card): { rank: Rank; suit: Suit } {
  if (card.length !== 2) {
    throw new Error(`Invalid card format: ${card}`);
  }
  const rank = card[0] as Rank;
  const suit = card[1] as Suit;

  if (!RANKS.includes(rank)) {
    throw new Error(`Invalid rank in card: ${card}`);
  }
  if (!['h', 'd', 'c', 's'].includes(suit)) {
    throw new Error(`Invalid suit in card: ${card}`);
  }

  return { rank, suit };
}

/**
 * Returns the hand category: 'pair', 'suited', or 'offsuit'.
 */
export function getSuitedStatus(hand: Hand): HandCategory {
  const [card1, card2] = hand;
  const { rank: rank1, suit: suit1 } = parseCard(card1);
  const { rank: rank2, suit: suit2 } = parseCard(card2);

  // Validate not the same card
  if (card1 === card2) {
    throw new Error(`Hand contains duplicate card: ${card1}`);
  }

  if (rank1 === rank2) {
    return 'pair';
  }

  if (suit1 === suit2) {
    return 'suited';
  }

  return 'offsuit';
}

/**
 * Checks if two hands are suit-isomorphic.
 * Hands are isomorphic if they have the same ranks and same suited/offsuit pattern.
 * For example: [Ah, Kh] and [As, Ks] are isomorphic (both AKs)
 */
export function areIsomorphic(hand1: Hand, hand2: Hand): boolean {
  const { rank: rank1a, suit: suit1a } = parseCard(hand1[0]);
  const { rank: rank1b, suit: suit1b } = parseCard(hand1[1]);
  const { rank: rank2a, suit: suit2a } = parseCard(hand2[0]);
  const { rank: rank2b, suit: suit2b } = parseCard(hand2[1]);

  // Normalize ranks to be in order (higher rank first)
  const [highRank1, lowRank1] = getRankValue(rank1a) <= getRankValue(rank1b)
    ? [rank1a, rank1b] : [rank1b, rank1a];
  const [highRank2, lowRank2] = getRankValue(rank2a) <= getRankValue(rank2b)
    ? [rank2a, rank2b] : [rank2b, rank2a];

  // Ranks must match
  if (highRank1 !== highRank2 || lowRank1 !== lowRank2) {
    return false;
  }

  // Suited status must match
  const status1 = getSuitedStatus(hand1);
  const status2 = getSuitedStatus(hand2);

  return status1 === status2;
}

/**
 * Maps a hand to its canonical suit form.
 * Canonical form:
 * - Higher rank card first
 * - First card always gets 'h' (hearts)
 * - Second card gets 'h' if suited, 'd' if offsuit
 *
 * This normalization ensures all isomorphic hands map to the same representation.
 */
export function mapToCanonicalSuit(hand: Hand): Hand {
  const { rank: rank1, suit: suit1 } = parseCard(hand[0]);
  const { rank: rank2, suit: suit2 } = parseCard(hand[1]);

  // Validate not the same card
  if (hand[0] === hand[1]) {
    throw new Error(`Hand contains duplicate card: ${hand[0]}`);
  }

  // Determine which rank is higher (lower value = higher rank)
  const value1 = getRankValue(rank1);
  const value2 = getRankValue(rank2);

  let highRank: Rank;
  let lowRank: Rank;
  let isSuited: boolean;

  if (value1 < value2) {
    // First card is higher
    highRank = rank1;
    lowRank = rank2;
    isSuited = suit1 === suit2;
  } else if (value2 < value1) {
    // Second card is higher
    highRank = rank2;
    lowRank = rank1;
    isSuited = suit1 === suit2;
  } else {
    // Same rank (pair) - order doesn't matter for pairs
    highRank = rank1;
    lowRank = rank2;
    isSuited = false; // Pairs by definition have different suits
  }

  // Canonical suit assignment
  const canonicalSuit1: Suit = 'h';
  const canonicalSuit2: Suit = isSuited ? 'h' : 'd';

  return [`${highRank}${canonicalSuit1}`, `${lowRank}${canonicalSuit2}`] as Hand;
}

/**
 * Extracts normalized rank order from a hand (higher rank first).
 */
export function getNormalizedRanks(hand: Hand): [Rank, Rank] {
  const { rank: rank1 } = parseCard(hand[0]);
  const { rank: rank2 } = parseCard(hand[1]);

  const value1 = getRankValue(rank1);
  const value2 = getRankValue(rank2);

  if (value1 <= value2) {
    return [rank1, rank2];
  }
  return [rank2, rank1];
}
