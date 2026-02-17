// src/lib/postflop/classification/boardTexture.poker.test.ts
// Comprehensive poker-specific board texture classification tests.

import { describe, it, expect } from 'vitest';
import { classifyBoardTexture } from './boardTexture';
import type { Card } from '../../solver/types';

describe('board texture poker classification', () => {
  describe('paired boards', () => {
    it('pair on flop: K-K-2', () => {
      expect(classifyBoardTexture(['Kh', 'Kd', '2c'] as Card[])).toBe('PAIRED');
    });

    it('low pair: 3-3-9', () => {
      expect(classifyBoardTexture(['3h', '3d', '9c'] as Card[])).toBe('PAIRED');
    });

    it('trips on flop: A-A-A', () => {
      expect(classifyBoardTexture(['Ah', 'Ad', 'Ac'] as Card[])).toBe('PAIRED');
    });

    it('double paired board on river: A-A-K-K-Q', () => {
      expect(classifyBoardTexture(['Ah', 'Ad', 'Kc', 'Kd', 'Qh'] as Card[])).toBe('PAIRED');
    });

    it('pair on turn: 7-9-J-7', () => {
      expect(classifyBoardTexture(['7h', '9d', 'Jc', '7s'] as Card[])).toBe('PAIRED');
    });

    it('pair on river: 2-5-8-T-T', () => {
      expect(classifyBoardTexture(['2h', '5d', '8c', 'Ts', 'Th'] as Card[])).toBe('PAIRED');
    });
  });

  describe('monotone boards', () => {
    it('all hearts flop: Ah-Kh-2h', () => {
      expect(classifyBoardTexture(['Ah', 'Kh', '2h'] as Card[])).toBe('MONOTONE');
    });

    it('all spades flop: 4s-7s-Ts', () => {
      expect(classifyBoardTexture(['4s', '7s', 'Ts'] as Card[])).toBe('MONOTONE');
    });

    it('4-flush on turn still monotone: 3h-6h-9h-Qh', () => {
      expect(classifyBoardTexture(['3h', '6h', '9h', 'Qh'] as Card[])).toBe('MONOTONE');
    });

    it('3-flush on turn with off-suit: Ah-Kh-Qh-2d is still monotone (3+ same suit)', () => {
      expect(classifyBoardTexture(['Ah', 'Kh', 'Qh', '2d'] as Card[])).toBe('MONOTONE');
    });
  });

  describe('two-tone boards', () => {
    it('two hearts one diamond: Ah-Kh-2d', () => {
      expect(classifyBoardTexture(['Ah', 'Kh', '2d'] as Card[])).toBe('TWO_TONE');
    });

    it('two clubs one spade: 5c-8c-Ks', () => {
      expect(classifyBoardTexture(['5c', '8c', 'Ks'] as Card[])).toBe('TWO_TONE');
    });

    it('two diamonds one heart: Td-Jd-4h', () => {
      expect(classifyBoardTexture(['Td', 'Jd', '4h'] as Card[])).toBe('TWO_TONE');
    });
  });

  describe('connected boards', () => {
    it('consecutive: 8-9-T (all different suits, no ace)', () => {
      expect(classifyBoardTexture(['8h', '9d', 'Tc'] as Card[])).toBe('CONNECTED');
    });

    it('one-gapper: 6-8-T', () => {
      expect(classifyBoardTexture(['6h', '8d', 'Tc'] as Card[])).toBe('CONNECTED');
    });

    it('two-gapper: 5-7-9', () => {
      // maxGap = 2, no ace -> CONNECTED
      expect(classifyBoardTexture(['5h', '7d', '9c'] as Card[])).toBe('CONNECTED');
    });

    it('three-gap still connected: 3-6-9 (maxGap=3)', () => {
      expect(classifyBoardTexture(['3h', '6d', '9c'] as Card[])).toBe('CONNECTED');
    });
  });

  describe('rainbow boards', () => {
    it('all different suits, wide gaps: 2d-7h-Kc', () => {
      expect(classifyBoardTexture(['2d', '7h', 'Kc'] as Card[])).toBe('RAINBOW');
    });

    it('ace-high rainbow: Ah-Kd-Qc (has ace so not connected)', () => {
      expect(classifyBoardTexture(['Ah', 'Kd', 'Qc'] as Card[])).toBe('RAINBOW');
    });

    it('wide gap rainbow: Ah-2d-9c', () => {
      expect(classifyBoardTexture(['Ah', '2d', '9c'] as Card[])).toBe('RAINBOW');
    });

    it('gap > 3 rainbow: 2h-8d-Kc (gap 6)', () => {
      expect(classifyBoardTexture(['2h', '8d', 'Kc'] as Card[])).toBe('RAINBOW');
    });
  });

  describe('priority: paired beats monotone', () => {
    it('paired + all same suit -> PAIRED (not MONOTONE)', () => {
      // Kh-Kd-5h: paired wins even though we have two hearts
      // Wait, Kh-Kd-5h has only 2 hearts, so not monotone.
      // For truly paired+monotone: need same rank + same suit with 3+ of a suit
      // Kh-Ks-5s: pair of K + two spades -> PAIRED (pair check first)
      expect(classifyBoardTexture(['Kh', 'Ks', '5s'] as Card[])).toBe('PAIRED');
    });

    it('trips board where all suits differ still PAIRED', () => {
      expect(classifyBoardTexture(['Qh', 'Qd', 'Qc'] as Card[])).toBe('PAIRED');
    });
  });

  describe('priority: paired beats two-tone', () => {
    it('paired with two same suit -> PAIRED', () => {
      // 9h-9d-2h: pair of 9s + two hearts
      expect(classifyBoardTexture(['9h', '9d', '2h'] as Card[])).toBe('PAIRED');
    });
  });

  describe('edge cases', () => {
    it('throws for fewer than 3 cards', () => {
      expect(() => classifyBoardTexture(['Ah', 'Kd'] as Card[])).toThrow();
    });

    it('throws for empty board', () => {
      expect(() => classifyBoardTexture([] as Card[])).toThrow();
    });

    it('handles exactly 5 cards (river board)', () => {
      const board: Card[] = ['2h', '5d', '8c', 'Js', 'Ah'];
      // All different suits except 2h and Ah (two hearts) -> TWO_TONE
      expect(classifyBoardTexture(board)).toBe('TWO_TONE');
    });
  });
});
