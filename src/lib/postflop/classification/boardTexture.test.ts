// src/lib/postflop/classification/boardTexture.test.ts
// TDD tests for board texture classification.

import { describe, it, expect } from 'vitest';
import { classifyBoardTexture } from './boardTexture';
import type { Card } from '../../solver/types';

describe('classifyBoardTexture', () => {
  // ---- PAIRED (priority 1) ----
  it('classifies paired board (AsAh2d -> PAIRED)', () => {
    const board: Card[] = ['As', 'Ah', '2d'];
    expect(classifyBoardTexture(board)).toBe('PAIRED');
  });

  it('classifies trips board as PAIRED over MONOTONE (AsAdAh -> PAIRED)', () => {
    // Three aces — paired AND could be confused with monotone if not checking rank first
    // Note: As, Ad, Ah are all different suits, so not actually monotone.
    // But the key point: PAIRED takes priority.
    const board: Card[] = ['As', 'Ad', 'Ah'];
    expect(classifyBoardTexture(board)).toBe('PAIRED');
  });

  it('classifies paired + two-tone as PAIRED (pair wins over suit)', () => {
    // Kh Kd 5h — paired AND two hearts
    const board: Card[] = ['Kh', 'Kd', '5h'];
    expect(classifyBoardTexture(board)).toBe('PAIRED');
  });

  // ---- MONOTONE (priority 2) ----
  it('classifies monotone board (AhKhQh -> MONOTONE)', () => {
    const board: Card[] = ['Ah', 'Kh', 'Qh'];
    expect(classifyBoardTexture(board)).toBe('MONOTONE');
  });

  // ---- TWO_TONE (priority 3) ----
  it('classifies two-tone board (AhKh2d -> TWO_TONE)', () => {
    const board: Card[] = ['Ah', 'Kh', '2d'];
    expect(classifyBoardTexture(board)).toBe('TWO_TONE');
  });

  // ---- CONNECTED (priority 4) ----
  it('classifies connected board with maxGap=1 (9h8d7c -> CONNECTED)', () => {
    const board: Card[] = ['9h', '8d', '7c'];
    expect(classifyBoardTexture(board)).toBe('CONNECTED');
  });

  it('classifies connected board with maxGap<=3 (Ts9d8h -> CONNECTED)', () => {
    const board: Card[] = ['Ts', '9d', '8h'];
    expect(classifyBoardTexture(board)).toBe('CONNECTED');
  });

  it('classifies gapped but still connected (Th8d6s -> CONNECTED, maxGap=2)', () => {
    const board: Card[] = ['Th', '8d', '6s'];
    expect(classifyBoardTexture(board)).toBe('CONNECTED');
  });

  // ---- RAINBOW (default, priority 5) ----
  it('classifies rainbow board (AhKdQc -> RAINBOW)', () => {
    const board: Card[] = ['Ah', 'Kd', 'Qc'];
    expect(classifyBoardTexture(board)).toBe('RAINBOW');
  });

  it('classifies wide-gap rainbow board (Ah2d9c -> RAINBOW, maxGap=11)', () => {
    const board: Card[] = ['Ah', '2d', '9c'];
    expect(classifyBoardTexture(board)).toBe('RAINBOW');
  });

  // ---- Edge cases ----
  it('throws if board has fewer than 3 cards', () => {
    expect(() => classifyBoardTexture(['Ah', 'Kh'] as Card[])).toThrow();
  });

  it('handles turn board (4 cards)', () => {
    // 4-card board: Ah Kh Qh 2d — still monotone for first 3, but all 4 not mono
    // With 4 cards: 3 hearts + 1 diamond = two_tone? Actually we check suit counts.
    // suitCounts: h=3, d=1 — 3 of same suit -> MONOTONE
    const board: Card[] = ['Ah', 'Kh', 'Qh', '2d'];
    expect(classifyBoardTexture(board)).toBe('MONOTONE');
  });

  it('handles river board (5 cards)', () => {
    // 5-card board with a pair
    const board: Card[] = ['As', 'Ah', '7d', '3c', '9h'];
    expect(classifyBoardTexture(board)).toBe('PAIRED');
  });
});
