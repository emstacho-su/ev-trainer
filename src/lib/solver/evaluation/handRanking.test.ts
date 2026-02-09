// src/lib/solver/evaluation/handRanking.test.ts
import { describe, it, expect } from 'vitest';
import {
  evaluateHand,
  compareHands,
  getHandCategory,
  getCategoryValue,
  categoryBeats,
  type HandCategory,
} from './handRanking';
import type { Card } from '../types';

describe('evaluateHand', () => {
  describe('valid inputs', () => {
    it('evaluates 5-card hands', () => {
      const hand: Card[] = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];
      const result = evaluateHand(hand);

      expect(result.value).toBeGreaterThan(0);
      expect(result.category).toBe('ROYAL_FLUSH');
      expect(result.description).toBeTruthy();
    });

    it('evaluates 6-card hands', () => {
      const hand: Card[] = ['Ah', 'Ad', 'Kh', 'Kd', 'Qh', 'Qd'];
      const result = evaluateHand(hand);

      expect(result.value).toBeGreaterThan(0);
      expect(['TWO_PAIR', 'FULL_HOUSE']).toContain(result.category);
    });

    it('evaluates 7-card hands', () => {
      const hand: Card[] = ['Ah', 'Ad', 'Kh', 'Kd', 'Qh', 'Qd', '2c'];
      const result = evaluateHand(hand);

      expect(result.value).toBeGreaterThan(0);
    });
  });

  describe('invalid inputs', () => {
    it('throws for less than 5 cards', () => {
      expect(() => evaluateHand(['Ah', 'Kh', 'Qh', 'Jh'] as Card[])).toThrow(
        'evaluateHand requires at least 5 cards'
      );
    });

    it('throws for more than 7 cards', () => {
      const cards: Card[] = ['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9h', '8h', '7h'];
      expect(() => evaluateHand(cards)).toThrow(
        'evaluateHand accepts at most 7 cards'
      );
    });
  });

  describe('hand categories', () => {
    it('evaluates high card', () => {
      const hand: Card[] = ['Ah', 'Kc', '8d', '6s', '2h'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('HIGH_CARD');
    });

    it('evaluates pair', () => {
      const hand: Card[] = ['Ah', 'Ad', 'Kc', 'Qd', '2s'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('PAIR');
    });

    it('evaluates two pair', () => {
      const hand: Card[] = ['Ah', 'Ad', 'Kc', 'Kd', '2s'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('TWO_PAIR');
    });

    it('evaluates three of a kind', () => {
      const hand: Card[] = ['Ah', 'Ad', 'Ac', 'Kd', '2s'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('THREE_OF_A_KIND');
    });

    it('evaluates straight', () => {
      const hand: Card[] = ['Ah', 'Kc', 'Qd', 'Js', 'Th'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('STRAIGHT');
    });

    it('evaluates wheel straight (A-2-3-4-5)', () => {
      const hand: Card[] = ['Ah', '2c', '3d', '4s', '5h'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('STRAIGHT');
    });

    it('evaluates flush', () => {
      const hand: Card[] = ['Ah', 'Kh', '8h', '6h', '2h'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('FLUSH');
    });

    it('evaluates full house', () => {
      const hand: Card[] = ['Ah', 'Ad', 'Ac', 'Kd', 'Ks'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('FULL_HOUSE');
    });

    it('evaluates four of a kind', () => {
      const hand: Card[] = ['Ah', 'Ad', 'Ac', 'As', 'Kd'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('FOUR_OF_A_KIND');
    });

    it('evaluates straight flush', () => {
      const hand: Card[] = ['9h', '8h', '7h', '6h', '5h'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('STRAIGHT_FLUSH');
    });

    it('evaluates royal flush', () => {
      const hand: Card[] = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];
      const result = evaluateHand(hand);
      expect(result.category).toBe('ROYAL_FLUSH');
    });
  });

  describe('hand value ordering', () => {
    it('ranks AA above KK on dry board', () => {
      const board: Card[] = ['2c', '5d', '8h'];
      const aa: Card[] = ['Ah', 'Ad', ...board];
      const kk: Card[] = ['Kh', 'Kd', ...board];

      const aaRank = evaluateHand(aa);
      const kkRank = evaluateHand(kk);

      expect(aaRank.value).toBeGreaterThan(kkRank.value);
    });

    it('ranks flush above straight', () => {
      const flush: Card[] = ['Ah', 'Kh', '8h', '6h', '2h'];
      const straight: Card[] = ['Ah', 'Kc', 'Qd', 'Js', 'Th'];

      const flushRank = evaluateHand(flush);
      const straightRank = evaluateHand(straight);

      expect(flushRank.value).toBeGreaterThan(straightRank.value);
    });

    it('ranks full house above flush', () => {
      const fullHouse: Card[] = ['Ah', 'Ad', 'Ac', 'Kd', 'Ks'];
      const flush: Card[] = ['Ah', 'Kh', '8h', '6h', '2h'];

      const fullHouseRank = evaluateHand(fullHouse);
      const flushRank = evaluateHand(flush);

      expect(fullHouseRank.value).toBeGreaterThan(flushRank.value);
    });
  });
});

describe('compareHands', () => {
  it('returns 1 when hand1 wins', () => {
    const hand1: Card[] = ['Ah', 'Ad']; // Pocket aces
    const hand2: Card[] = ['Kh', 'Kd']; // Pocket kings
    const board: Card[] = ['2c', '5d', '8s'];

    expect(compareHands(hand1, hand2, board)).toBe(1);
  });

  it('returns -1 when hand2 wins', () => {
    const hand1: Card[] = ['Kh', 'Kd']; // Pocket kings
    const hand2: Card[] = ['Ah', 'Ad']; // Pocket aces
    const board: Card[] = ['2c', '5d', '8s'];

    expect(compareHands(hand1, hand2, board)).toBe(-1);
  });

  it('returns 0 for ties', () => {
    // Both have same straight
    const hand1: Card[] = ['Ah', '2c'];
    const hand2: Card[] = ['As', '2d'];
    const board: Card[] = ['Kd', 'Qc', 'Jh', 'Ts', '9h'];

    // Both have A-K-Q-J-T straight (board plays)
    expect(compareHands(hand1, hand2, board)).toBe(0);
  });

  it('handles flop (3 board cards)', () => {
    const hand1: Card[] = ['Ah', 'Ad'];
    const hand2: Card[] = ['Kh', 'Kd'];
    const board: Card[] = ['2c', '5d', '8s'];

    expect(compareHands(hand1, hand2, board)).toBe(1);
  });

  it('handles turn (4 board cards)', () => {
    const hand1: Card[] = ['Ah', 'Ad'];
    const hand2: Card[] = ['Kh', 'Kd'];
    const board: Card[] = ['2c', '5d', '8s', 'Jc'];

    expect(compareHands(hand1, hand2, board)).toBe(1);
  });

  it('handles river (5 board cards)', () => {
    const hand1: Card[] = ['Ah', 'Ad'];
    const hand2: Card[] = ['Kh', 'Kd'];
    const board: Card[] = ['2c', '5d', '8s', 'Jc', 'Qs'];

    expect(compareHands(hand1, hand2, board)).toBe(1);
  });

  it('throws for insufficient cards', () => {
    const hand1: Card[] = ['Ah', 'Ad'];
    const hand2: Card[] = ['Kh', 'Kd'];
    const board: Card[] = ['2c', '5d']; // Only 2 cards

    expect(() => compareHands(hand1, hand2, board)).toThrow(
      'compareHands requires at least 5 cards per hand'
    );
  });
});

describe('getHandCategory', () => {
  it('returns the category from a HandRank', () => {
    const hand: Card[] = ['Ah', 'Ad', 'Kc', 'Qd', '2s'];
    const rank = evaluateHand(hand);

    expect(getHandCategory(rank)).toBe('PAIR');
  });
});

describe('getCategoryValue', () => {
  it('returns increasing values for stronger categories', () => {
    const categories: HandCategory[] = [
      'HIGH_CARD',
      'PAIR',
      'TWO_PAIR',
      'THREE_OF_A_KIND',
      'STRAIGHT',
      'FLUSH',
      'FULL_HOUSE',
      'FOUR_OF_A_KIND',
      'STRAIGHT_FLUSH',
      'ROYAL_FLUSH',
    ];

    for (let i = 1; i < categories.length; i++) {
      expect(getCategoryValue(categories[i])).toBeGreaterThan(
        getCategoryValue(categories[i - 1])
      );
    }
  });
});

describe('categoryBeats', () => {
  it('returns true when first category is better', () => {
    expect(categoryBeats('PAIR', 'HIGH_CARD')).toBe(true);
    expect(categoryBeats('FLUSH', 'STRAIGHT')).toBe(true);
    expect(categoryBeats('ROYAL_FLUSH', 'STRAIGHT_FLUSH')).toBe(true);
  });

  it('returns false when first category is worse', () => {
    expect(categoryBeats('HIGH_CARD', 'PAIR')).toBe(false);
    expect(categoryBeats('STRAIGHT', 'FLUSH')).toBe(false);
  });

  it('returns false for equal categories', () => {
    expect(categoryBeats('PAIR', 'PAIR')).toBe(false);
    expect(categoryBeats('FLUSH', 'FLUSH')).toBe(false);
  });
});
