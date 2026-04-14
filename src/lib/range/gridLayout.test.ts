// src/lib/range/gridLayout.test.ts
import { describe, it, expect } from 'vitest';
import { getHandAtPosition, getGridPosition, RANKS, RANK_INDEX } from './gridLayout';

describe('getHandAtPosition', () => {
  it('returns pairs on the diagonal', () => {
    expect(getHandAtPosition(0, 0)).toBe('AA');
    expect(getHandAtPosition(1, 1)).toBe('KK');
    expect(getHandAtPosition(12, 12)).toBe('22');
  });

  it('returns suited hands above diagonal', () => {
    expect(getHandAtPosition(0, 1)).toBe('AKs');
    expect(getHandAtPosition(0, 12)).toBe('A2s');
    expect(getHandAtPosition(4, 5)).toBe('T9s');
  });

  it('returns offsuit hands below diagonal', () => {
    expect(getHandAtPosition(1, 0)).toBe('AKo');
    expect(getHandAtPosition(12, 0)).toBe('A2o');
    expect(getHandAtPosition(5, 4)).toBe('T9o');
  });

  it('returns null for out of bounds', () => {
    expect(getHandAtPosition(-1, 0)).toBeNull();
    expect(getHandAtPosition(0, 13)).toBeNull();
    expect(getHandAtPosition(13, 13)).toBeNull();
  });

  it('covers all 169 positions', () => {
    const hands = new Set<string>();
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        const hand = getHandAtPosition(r, c);
        expect(hand).not.toBeNull();
        hands.add(hand!);
      }
    }
    expect(hands.size).toBe(169);
  });
});

describe('getGridPosition', () => {
  it('maps pairs to diagonal', () => {
    expect(getGridPosition('AA')).toEqual([0, 0]);
    expect(getGridPosition('KK')).toEqual([1, 1]);
    expect(getGridPosition('22')).toEqual([12, 12]);
  });

  it('maps suited hands above diagonal', () => {
    expect(getGridPosition('AKs')).toEqual([0, 1]);
    expect(getGridPosition('A2s')).toEqual([0, 12]);
  });

  it('maps offsuit hands below diagonal', () => {
    expect(getGridPosition('AKo')).toEqual([1, 0]);
    expect(getGridPosition('A2o')).toEqual([12, 0]);
  });

  it('returns null for invalid hands', () => {
    expect(getGridPosition('X')).toBeNull();
    expect(getGridPosition('ABCD')).toBeNull();
    expect(getGridPosition('XY')).toBeNull();
  });

  it('is inverse of getHandAtPosition', () => {
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        const hand = getHandAtPosition(r, c)!;
        const pos = getGridPosition(hand);
        expect(pos).toEqual([r, c]);
      }
    }
  });
});

describe('RANKS and RANK_INDEX', () => {
  it('has 13 ranks', () => {
    expect(RANKS.length).toBe(13);
  });

  it('starts with A and ends with 2', () => {
    expect(RANKS[0]).toBe('A');
    expect(RANKS[12]).toBe('2');
  });

  it('RANK_INDEX is inverse of RANKS', () => {
    for (let i = 0; i < RANKS.length; i++) {
      expect(RANK_INDEX[RANKS[i]]).toBe(i);
    }
  });
});
