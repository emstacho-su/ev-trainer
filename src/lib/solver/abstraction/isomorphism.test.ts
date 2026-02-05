// src/lib/solver/abstraction/isomorphism.test.ts
import { describe, it, expect } from 'vitest';
import {
  getRankValue,
  parseCard,
  getSuitedStatus,
  areIsomorphic,
  mapToCanonicalSuit,
  getNormalizedRanks,
} from './isomorphism';
import type { Hand } from '../types';

describe('getRankValue', () => {
  it('returns 0 for Ace (highest)', () => {
    expect(getRankValue('A')).toBe(0);
  });

  it('returns 1 for King', () => {
    expect(getRankValue('K')).toBe(1);
  });

  it('returns 12 for 2 (lowest)', () => {
    expect(getRankValue('2')).toBe(12);
  });

  it('returns correct values for all ranks', () => {
    expect(getRankValue('Q')).toBe(2);
    expect(getRankValue('J')).toBe(3);
    expect(getRankValue('T')).toBe(4);
    expect(getRankValue('9')).toBe(5);
    expect(getRankValue('5')).toBe(9);
  });
});

describe('parseCard', () => {
  it('parses valid cards correctly', () => {
    expect(parseCard('Ah')).toEqual({ rank: 'A', suit: 'h' });
    expect(parseCard('Kc')).toEqual({ rank: 'K', suit: 'c' });
    expect(parseCard('2s')).toEqual({ rank: '2', suit: 's' });
    expect(parseCard('Td')).toEqual({ rank: 'T', suit: 'd' });
  });

  it('throws for invalid card format', () => {
    expect(() => parseCard('A' as any)).toThrow('Invalid card format');
    expect(() => parseCard('Ahh' as any)).toThrow('Invalid card format');
  });
});

describe('getSuitedStatus', () => {
  it('returns pair for same rank different suits', () => {
    expect(getSuitedStatus(['Ah', 'Ad'])).toBe('pair');
    expect(getSuitedStatus(['Ks', 'Kc'])).toBe('pair');
    expect(getSuitedStatus(['2h', '2s'])).toBe('pair');
  });

  it('returns suited for same suit different ranks', () => {
    expect(getSuitedStatus(['Ah', 'Kh'])).toBe('suited');
    expect(getSuitedStatus(['9s', '8s'])).toBe('suited');
    expect(getSuitedStatus(['7d', '2d'])).toBe('suited');
  });

  it('returns offsuit for different suit different ranks', () => {
    expect(getSuitedStatus(['Ah', 'Kd'])).toBe('offsuit');
    expect(getSuitedStatus(['9s', '8c'])).toBe('offsuit');
    expect(getSuitedStatus(['7h', '2c'])).toBe('offsuit');
  });

  it('throws for duplicate cards', () => {
    expect(() => getSuitedStatus(['Ah', 'Ah'])).toThrow('duplicate card');
  });
});

describe('areIsomorphic', () => {
  it('returns true for suited hands with same ranks', () => {
    // AKs variants
    expect(areIsomorphic(['Ah', 'Kh'], ['As', 'Ks'])).toBe(true);
    expect(areIsomorphic(['Ah', 'Kh'], ['Ad', 'Kd'])).toBe(true);
    expect(areIsomorphic(['Ah', 'Kh'], ['Ac', 'Kc'])).toBe(true);
  });

  it('returns true for offsuit hands with same ranks', () => {
    // AKo variants
    expect(areIsomorphic(['Ah', 'Kd'], ['As', 'Kc'])).toBe(true);
    expect(areIsomorphic(['Ah', 'Ks'], ['Ad', 'Kc'])).toBe(true);
  });

  it('returns true for pairs', () => {
    // AA variants
    expect(areIsomorphic(['Ah', 'Ad'], ['As', 'Ac'])).toBe(true);
    expect(areIsomorphic(['Ah', 'As'], ['Ad', 'Ac'])).toBe(true);
    // KK variants
    expect(areIsomorphic(['Kh', 'Kd'], ['Ks', 'Kc'])).toBe(true);
  });

  it('returns false for suited vs offsuit same ranks', () => {
    expect(areIsomorphic(['Ah', 'Kh'], ['Ah', 'Kd'])).toBe(false);
    expect(areIsomorphic(['9s', '8s'], ['9s', '8c'])).toBe(false);
  });

  it('returns false for different ranks', () => {
    expect(areIsomorphic(['Ah', 'Kh'], ['Ah', 'Qh'])).toBe(false);
    expect(areIsomorphic(['Ah', 'Ad'], ['Kh', 'Kd'])).toBe(false);
  });

  it('handles rank order correctly', () => {
    // Should be isomorphic regardless of order in the hand
    expect(areIsomorphic(['Kh', 'Ah'], ['As', 'Ks'])).toBe(true);
    expect(areIsomorphic(['7h', '2h'], ['2s', '7s'])).toBe(true);
  });
});

describe('mapToCanonicalSuit', () => {
  it('normalizes suited hands to Xh Yh', () => {
    expect(mapToCanonicalSuit(['Ah', 'Kh'])).toEqual(['Ah', 'Kh']);
    expect(mapToCanonicalSuit(['As', 'Ks'])).toEqual(['Ah', 'Kh']);
    expect(mapToCanonicalSuit(['Ad', 'Kd'])).toEqual(['Ah', 'Kh']);
    expect(mapToCanonicalSuit(['Ac', 'Kc'])).toEqual(['Ah', 'Kh']);
  });

  it('normalizes offsuit hands to Xh Yd', () => {
    expect(mapToCanonicalSuit(['Ah', 'Kd'])).toEqual(['Ah', 'Kd']);
    expect(mapToCanonicalSuit(['As', 'Kc'])).toEqual(['Ah', 'Kd']);
    expect(mapToCanonicalSuit(['Ad', 'Kh'])).toEqual(['Ah', 'Kd']);
  });

  it('normalizes pairs to Xh Yd (different suits)', () => {
    expect(mapToCanonicalSuit(['Ah', 'Ad'])).toEqual(['Ah', 'Ad']);
    expect(mapToCanonicalSuit(['As', 'Ac'])).toEqual(['Ah', 'Ad']);
  });

  it('puts higher rank first', () => {
    expect(mapToCanonicalSuit(['Kh', 'Ah'])).toEqual(['Ah', 'Kh']);
    expect(mapToCanonicalSuit(['2s', '7s'])).toEqual(['7h', '2h']);
    expect(mapToCanonicalSuit(['3d', 'Ac'])).toEqual(['Ah', '3d']);
  });

  it('produces consistent output for isomorphic hands', () => {
    const hands: Hand[] = [
      ['Ah', 'Kh'],
      ['As', 'Ks'],
      ['Ad', 'Kd'],
      ['Ac', 'Kc'],
      ['Kh', 'Ah'],
      ['Ks', 'As'],
    ];

    const results = hands.map(mapToCanonicalSuit);
    const first = results[0];
    for (const result of results) {
      expect(result).toEqual(first);
    }
  });

  it('throws for duplicate cards', () => {
    expect(() => mapToCanonicalSuit(['Ah', 'Ah'])).toThrow('duplicate card');
  });
});

describe('getNormalizedRanks', () => {
  it('returns higher rank first', () => {
    expect(getNormalizedRanks(['Ah', 'Kd'])).toEqual(['A', 'K']);
    expect(getNormalizedRanks(['Kd', 'Ah'])).toEqual(['A', 'K']);
    expect(getNormalizedRanks(['7s', '2c'])).toEqual(['7', '2']);
    expect(getNormalizedRanks(['2c', '7s'])).toEqual(['7', '2']);
  });

  it('handles pairs (same rank)', () => {
    expect(getNormalizedRanks(['Ah', 'Ad'])).toEqual(['A', 'A']);
    expect(getNormalizedRanks(['Kh', 'Ks'])).toEqual(['K', 'K']);
  });
});
