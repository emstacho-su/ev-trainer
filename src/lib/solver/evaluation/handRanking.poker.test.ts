// src/lib/solver/evaluation/handRanking.poker.test.ts
// Poker-specific hand ranking validation tests with known matchups.

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

describe('hand ranking poker matchups', () => {
  describe('royal flush vs straight flush', () => {
    it('royal flush beats 9-high straight flush', () => {
      const royalFlush: Card[] = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];
      const straightFlush: Card[] = ['9s', '8s', '7s', '6s', '5s'];

      const royalRank = evaluateHand(royalFlush);
      const sfRank = evaluateHand(straightFlush);

      expect(royalRank.category).toBe('ROYAL_FLUSH');
      expect(sfRank.category).toBe('STRAIGHT_FLUSH');
      expect(royalRank.value).toBeGreaterThan(sfRank.value);
    });

    it('compareHands returns 1 for royal flush over straight flush', () => {
      const royal: Card[] = ['Ah', 'Kh'];
      const sf: Card[] = ['9s', '8s'];
      const board: Card[] = ['Qh', 'Jh', 'Th', '7s', '6s'];

      // Player 1 has royal flush, player 2 has straight flush
      expect(compareHands(royal, sf, board)).toBe(1);
    });
  });

  describe('full house vs flush', () => {
    it('full house beats flush', () => {
      const fullHouse: Card[] = ['Ah', 'Ad', 'Ac', 'Kd', 'Ks'];
      const flush: Card[] = ['Ah', 'Kh', 'Qh', '9h', '2h'];

      const fhRank = evaluateHand(fullHouse);
      const flushRank = evaluateHand(flush);

      expect(fhRank.category).toBe('FULL_HOUSE');
      expect(flushRank.category).toBe('FLUSH');
      expect(fhRank.value).toBeGreaterThan(flushRank.value);
    });

    it('full house beats flush via compareHands on shared board', () => {
      // Board: Kh Kd 5h 5d 2h
      // Player 1: Ks 5s -> full house K-K-K-5-5... wait, K trips + 5 pair
      // Player 1: Kc 5c -> full house KKK55
      // Player 2: Ah 9h -> flush (Ah Kh 5h 2h 9h)
      const hand1: Card[] = ['Kc', '5c'];
      const hand2: Card[] = ['Ah', '9h'];
      const board: Card[] = ['Kh', 'Kd', '5h', '5d', '2h'];

      expect(compareHands(hand1, hand2, board)).toBe(1);
    });
  });

  describe('two pair kicker scenarios', () => {
    it('K-K-5-5-A beats K-K-5-5-Q (ace kicker wins)', () => {
      const kkA: Card[] = ['Kh', 'Kd', '5c', '5s', 'Ah'];
      const kkQ: Card[] = ['Kc', 'Ks', '5h', '5d', 'Qh'];

      const rankA = evaluateHand(kkA);
      const rankQ = evaluateHand(kkQ);

      expect(rankA.category).toBe('TWO_PAIR');
      expect(rankQ.category).toBe('TWO_PAIR');
      expect(rankA.value).toBeGreaterThan(rankQ.value);
    });

    it('A-A-K-K-x beats Q-Q-J-J-A (higher top pair wins)', () => {
      const aakk: Card[] = ['Ah', 'Ad', 'Kc', 'Kd', '2s'];
      const qqjj: Card[] = ['Qh', 'Qd', 'Jc', 'Jd', 'As'];

      const rankAA = evaluateHand(aakk);
      const rankQQ = evaluateHand(qqjj);

      expect(rankAA.value).toBeGreaterThan(rankQQ.value);
    });
  });

  describe('split pot scenarios', () => {
    it('board plays: same hand for both players (tie)', () => {
      // Board has the best 5-card hand; hole cards don't improve
      const hand1: Card[] = ['2h', '3c'];
      const hand2: Card[] = ['2d', '3s'];
      const board: Card[] = ['Ah', 'Kd', 'Qc', 'Js', 'Ts'];

      // Both play A-K-Q-J-T straight from board
      expect(compareHands(hand1, hand2, board)).toBe(0);
    });

    it('identical pocket pairs on unpaired board split', () => {
      const hand1: Card[] = ['7h', '7d'];
      const hand2: Card[] = ['7c', '7s'];
      const board: Card[] = ['Ah', 'Kd', 'Qc'];

      // Both have pair of 7s with A-K-Q kickers
      expect(compareHands(hand1, hand2, board)).toBe(0);
    });
  });

  describe('wheel vs broadway straight', () => {
    it('broadway straight (T-J-Q-K-A) beats wheel (A-2-3-4-5)', () => {
      const broadway: Card[] = ['Th', 'Jc', 'Qd', 'Ks', 'Ah'];
      const wheel: Card[] = ['Ac', '2d', '3s', '4h', '5c'];

      const broadwayRank = evaluateHand(broadway);
      const wheelRank = evaluateHand(wheel);

      expect(broadwayRank.category).toBe('STRAIGHT');
      expect(wheelRank.category).toBe('STRAIGHT');
      expect(broadwayRank.value).toBeGreaterThan(wheelRank.value);
    });

    it('wheel straight is lowest straight', () => {
      const wheel: Card[] = ['Ah', '2c', '3d', '4s', '5h'];
      const sixHigh: Card[] = ['2d', '3c', '4h', '5s', '6c'];

      const wheelRank = evaluateHand(wheel);
      const sixRank = evaluateHand(sixHigh);

      expect(wheelRank.category).toBe('STRAIGHT');
      expect(sixRank.category).toBe('STRAIGHT');
      expect(sixRank.value).toBeGreaterThan(wheelRank.value);
    });
  });

  describe('all 10 hand categories correctly identified', () => {
    const cases: Array<{ name: string; cards: Card[]; expected: HandCategory }> = [
      { name: 'high card', cards: ['Ah', 'Kc', '8d', '6s', '2h'], expected: 'HIGH_CARD' },
      { name: 'pair', cards: ['Ah', 'Ad', 'Kc', 'Qd', '2s'], expected: 'PAIR' },
      { name: 'two pair', cards: ['Ah', 'Ad', 'Kc', 'Kd', '2s'], expected: 'TWO_PAIR' },
      { name: 'three of a kind', cards: ['Ah', 'Ad', 'Ac', 'Kd', '2s'], expected: 'THREE_OF_A_KIND' },
      { name: 'straight', cards: ['5h', '6c', '7d', '8s', '9h'], expected: 'STRAIGHT' },
      { name: 'flush', cards: ['Ah', 'Kh', '8h', '6h', '2h'], expected: 'FLUSH' },
      { name: 'full house', cards: ['Ah', 'Ad', 'Ac', 'Kd', 'Ks'], expected: 'FULL_HOUSE' },
      { name: 'four of a kind', cards: ['Ah', 'Ad', 'Ac', 'As', 'Kd'], expected: 'FOUR_OF_A_KIND' },
      { name: 'straight flush', cards: ['5h', '6h', '7h', '8h', '9h'], expected: 'STRAIGHT_FLUSH' },
      { name: 'royal flush', cards: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'], expected: 'ROYAL_FLUSH' },
    ];

    for (const { name, cards, expected } of cases) {
      it(`identifies ${name}`, () => {
        const rank = evaluateHand(cards);
        expect(rank.category).toBe(expected);
      });
    }
  });

  describe('compareHands returns correct values', () => {
    it('returns 1 when hand1 wins (aces vs kings)', () => {
      expect(compareHands(['Ah', 'Ad'], ['Kh', 'Kd'], ['2c', '5d', '8s'])).toBe(1);
    });

    it('returns -1 when hand2 wins (kings vs aces)', () => {
      expect(compareHands(['Kh', 'Kd'], ['Ah', 'Ad'], ['2c', '5d', '8s'])).toBe(-1);
    });

    it('returns 0 for split pot', () => {
      // Both players have same flush from board
      expect(compareHands(['2d', '3c'], ['2c', '3d'], ['Ah', 'Kh', 'Qh', 'Jh', '9h'])).toBe(0);
    });

    it('flush beats straight on same board', () => {
      // Board: 8h 9h Tc Jd 2h
      // Player 1: Ah 3h -> flush (Ah 8h 9h 2h 3h)
      // Player 2: Qs Kd -> straight (9-T-J-Q-K)
      const hand1: Card[] = ['Ah', '3h'];
      const hand2: Card[] = ['Qs', 'Kd'];
      const board: Card[] = ['8h', '9h', 'Tc', 'Jd', '2h'];

      expect(compareHands(hand1, hand2, board)).toBe(1);
    });
  });

  describe('category value ordering', () => {
    it('getCategoryValue returns 1-10 in strict order', () => {
      const ordered: HandCategory[] = [
        'HIGH_CARD', 'PAIR', 'TWO_PAIR', 'THREE_OF_A_KIND', 'STRAIGHT',
        'FLUSH', 'FULL_HOUSE', 'FOUR_OF_A_KIND', 'STRAIGHT_FLUSH', 'ROYAL_FLUSH',
      ];

      for (let i = 0; i < ordered.length; i++) {
        expect(getCategoryValue(ordered[i])).toBe(i + 1);
      }
    });

    it('categoryBeats is consistent with getCategoryValue', () => {
      const cats: HandCategory[] = [
        'HIGH_CARD', 'PAIR', 'TWO_PAIR', 'THREE_OF_A_KIND', 'STRAIGHT',
        'FLUSH', 'FULL_HOUSE', 'FOUR_OF_A_KIND', 'STRAIGHT_FLUSH', 'ROYAL_FLUSH',
      ];

      for (let i = 0; i < cats.length; i++) {
        for (let j = 0; j < cats.length; j++) {
          const expected = getCategoryValue(cats[i]) > getCategoryValue(cats[j]);
          expect(categoryBeats(cats[i], cats[j])).toBe(expected);
        }
      }
    });
  });

  describe('7-card hand selection', () => {
    it('finds best 5-card hand from 7 cards', () => {
      // Hole: Ah Kh, Board: Qh Jh Th 2d 3c
      // Best hand is royal flush (Ah Kh Qh Jh Th)
      const cards: Card[] = ['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2d', '3c'];
      const rank = evaluateHand(cards);
      expect(rank.category).toBe('ROYAL_FLUSH');
    });

    it('picks full house over two pair when both possible', () => {
      // Cards contain AAAKK plus two random cards
      const cards: Card[] = ['Ah', 'Ad', 'Ac', 'Kh', 'Kd', '2s', '3c'];
      const rank = evaluateHand(cards);
      expect(rank.category).toBe('FULL_HOUSE');
    });
  });
});
