// src/lib/postflop/classification/boardTexture.ts
// Board texture classification for postflop training.

import type { Card } from '../../solver/types';
import type { BoardTexture } from '../types';

/** Map rank character to numeric value (A=14 down to 2=2). */
const RANK_VALUES: Record<string, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

/**
 * Classifies the texture of a board (flop or later).
 * Requires at least 3 cards.
 *
 * Priority order:
 * 1. PAIRED - any two cards share rank
 * 2. MONOTONE - 3+ cards share suit
 * 3. TWO_TONE - exactly 2 cards share suit
 * 4. CONNECTED - rainbow, max gap between adjacent sorted ranks <= 3
 * 5. RAINBOW - default
 */
export function classifyBoardTexture(board: Card[]): BoardTexture {
  if (board.length < 3) {
    throw new Error(`Board must have at least 3 cards, got ${board.length}`);
  }

  // Parse ranks and suits
  const ranks: number[] = [];
  const rankCounts = new Map<string, number>();
  const suitCounts = new Map<string, number>();

  for (const card of board) {
    const rankChar = card[0];
    const suitChar = card[1];

    ranks.push(RANK_VALUES[rankChar]);
    rankCounts.set(rankChar, (rankCounts.get(rankChar) ?? 0) + 1);
    suitCounts.set(suitChar, (suitCounts.get(suitChar) ?? 0) + 1);
  }

  // 1. PAIRED — any rank appears 2+ times
  for (const count of rankCounts.values()) {
    if (count >= 2) return 'PAIRED';
  }

  // 2. MONOTONE — any suit appears 3+ times
  for (const count of suitCounts.values()) {
    if (count >= 3) return 'MONOTONE';
  }

  // 3. TWO_TONE — any suit appears 2+ times
  for (const count of suitCounts.values()) {
    if (count >= 2) return 'TWO_TONE';
  }

  // 4. CONNECTED — sort ranks, check max gap between adjacent <= 3
  //    Ace-high boards (e.g. AKQ) are not considered "connected" in poker
  //    terminology — they are broadway/rainbow boards.
  const sorted = [...ranks].sort((a, b) => a - b);
  const hasAce = sorted[sorted.length - 1] === 14;
  let maxGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > maxGap) maxGap = gap;
  }
  if (maxGap <= 3 && !hasAce) return 'CONNECTED';

  // 5. RAINBOW — default
  return 'RAINBOW';
}
