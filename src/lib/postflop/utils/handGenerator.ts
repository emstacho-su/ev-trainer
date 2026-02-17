// src/lib/postflop/utils/handGenerator.ts
// Generates random postflop hands for training sessions.

import type { Card } from '../../solver/types';
import { RANKS, SUITS } from '../../solver/types';
import type { PostflopSpot } from '../types';

/** Build a standard 52-card deck. */
function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }
  return deck;
}

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Round to nearest 0.5 BB. */
function roundHalfBb(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Sample preflop history descriptions. */
const PREFLOP_HISTORIES = [
  'BTN raised, BB called',
  'CO raised, BTN 3-bet, CO called',
  'HJ raised, CO called',
  'BTN raised, SB 3-bet, BTN called',
  'UTG raised, BB called',
  'CO raised, BB 3-bet, CO called',
  'MP raised, BTN called',
  'SB raised, BB called',
];

/**
 * Generate a random postflop hand for training.
 * Returns a full PostflopSpot with 5-card board (flop shown first, turn/river used later),
 * 2 hero cards, random pot/stack sizes, and random positions.
 */
export function generatePostflopHand(): PostflopSpot {
  const deck = shuffle(buildDeck());

  // Deal: 5 board cards + 2 hero cards from shuffled deck
  const board = deck.slice(0, 5) as [Card, Card, Card, Card, Card];
  const heroHand: [Card, Card] = [deck[5], deck[6]];

  // Random pot size: 20-100 BB, rounded to 0.5 BB
  const potBb = roundHalfBb(20 + Math.random() * 80);

  // Random stack size: 50-300 BB (whole numbers)
  const stackBb = Math.round(50 + Math.random() * 250);

  // Random position assignment
  const heroPosition: 'IP' | 'OOP' = Math.random() < 0.5 ? 'IP' : 'OOP';
  const villainPosition: 'IP' | 'OOP' = heroPosition === 'IP' ? 'OOP' : 'IP';

  // Random preflop history
  const preflopHistory = PREFLOP_HISTORIES[Math.floor(Math.random() * PREFLOP_HISTORIES.length)];

  return {
    heroHand,
    board,
    potBb,
    stackBb,
    heroPosition,
    villainPosition,
    preflopHistory,
  };
}
