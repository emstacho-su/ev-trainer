// src/lib/postflop/classification/boardTexture.ts
// Board texture classification for postflop training.

import type { Card } from '../../solver/types';
import type { BoardTexture } from '../types';

/**
 * Classifies the texture of a board (flop or later).
 * Requires at least 3 cards.
 *
 * Priority order:
 * 1. PAIRED - any two cards share rank
 * 2. MONOTONE - all three cards share suit
 * 3. TWO_TONE - exactly two cards share suit
 * 4. CONNECTED - rainbow, max gap between adjacent sorted ranks <= 3
 * 5. RAINBOW - default
 */
export function classifyBoardTexture(_board: Card[]): BoardTexture {
  // Stub - will fail tests
  throw new Error('Not implemented');
}
