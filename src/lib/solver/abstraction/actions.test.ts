// src/lib/solver/abstraction/actions.test.ts

import { describe, it, expect } from 'vitest';
import {
  getAbstractedBetSizes,
  getAbstractedRaiseSizes,
  roundToBb,
  toEngineActionAbstraction,
  DEFAULT_BET_SIZES,
  DEFAULT_RAISE_SIZES,
} from './actions';
import type { BetSizeConfig, ActionAbstractionConfig } from '../types';

describe('roundToBb', () => {
  it('rounds to 0.5 BB precision', () => {
    expect(roundToBb(3.24)).toBe(3);
    expect(roundToBb(3.25)).toBe(3.5);
    expect(roundToBb(3.74)).toBe(3.5);
    expect(roundToBb(3.75)).toBe(4);
  });

  it('handles whole numbers', () => {
    expect(roundToBb(5)).toBe(5);
    expect(roundToBb(10)).toBe(10);
  });

  it('handles zero', () => {
    expect(roundToBb(0)).toBe(0);
  });
});

describe('getAbstractedBetSizes', () => {
  it('computes correct bet sizes for standard pot/stack', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 100,
    };

    const sizes = getAbstractedBetSizes(config);

    // Default flop sizes: 0.33, 0.5, 0.75, 1.0
    // 10 * 0.33 = 3.3 -> rounds to 3.5
    // 10 * 0.5 = 5
    // 10 * 0.75 = 7.5
    // 10 * 1.0 = 10
    expect(sizes).toEqual([3.5, 5, 7.5, 10]);
  });

  it('includes all-in when stack < 2x pot', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 15,
    };

    const sizes = getAbstractedBetSizes(config);

    // Stack (15) < 2 * pot (20), so all-in should be included
    // Valid bets: 3.5, 5, 7.5, 10 all fit
    // All-in: 15
    expect(sizes).toContain(15);
    expect(sizes).toEqual([3.5, 5, 7.5, 10, 15]);
  });

  it('returns only all-in when stack is tiny', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 5,
    };

    const sizes = getAbstractedBetSizes(config);

    // Stack = 5, pot = 10
    // Valid bets: 3.5 (fits), 5 (fits, equals stack)
    // Stack (5) < 2 * pot (20), so all-in (5) included
    // After dedup: [3.5, 5]
    expect(sizes).toContain(5);
    // 3.3 rounded = 3.5, which fits
    expect(sizes).toEqual([3.5, 5]);
  });

  it('filters out bets larger than stack', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 100,
      stackBb: 50,
    };

    const sizes = getAbstractedBetSizes(config);

    // 100 * 0.33 = 33, fits
    // 100 * 0.5 = 50, fits (equals stack)
    // 100 * 0.75 = 75, doesn't fit
    // 100 * 1.0 = 100, doesn't fit
    // All-in (50) included since stack < 2 * pot
    expect(sizes).toEqual([33, 50]);
  });

  it('deduplicates when bet size equals all-in', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 10, // Exactly pot-size is also all-in
    };

    const sizes = getAbstractedBetSizes(config);

    // All-in = 10, which is same as 100% pot bet
    // Should not have duplicates
    expect(sizes.filter((s) => s === 10)).toHaveLength(1);
  });

  it('handles tiny pot edge case', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 0.5,
      stackBb: 100,
    };

    const sizes = getAbstractedBetSizes(config);

    // Small bets: 0.5 * 0.33 = 0.165 -> rounds to 0
    // 0.5 * 0.5 = 0.25 -> rounds to 0.5
    // Results should only include positive values
    expect(sizes.every((s) => s > 0)).toBe(true);
  });

  it('handles tiny stack edge case', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 100,
      stackBb: 1,
    };

    const sizes = getAbstractedBetSizes(config);

    // Only all-in fits
    expect(sizes).toEqual([1]);
  });

  it('returns empty array for zero stack', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 0,
    };

    const sizes = getAbstractedBetSizes(config);
    expect(sizes).toEqual([]);
  });

  it('handles zero pot edge case', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 0,
      stackBb: 100,
    };

    const sizes = getAbstractedBetSizes(config);

    // Zero pot means all pot fractions are 0
    // Should return all-in since threshold check: 100 <= 2 * 0 is false
    // Actually: stack > 0 returns [stack] when pot <= 0
    expect(sizes).toEqual([100]);
  });

  it('accepts custom sizes', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 100,
    };

    const customSizes = [0.25, 0.5, 1.5];
    const sizes = getAbstractedBetSizes(config, customSizes);

    expect(sizes).toEqual([2.5, 5, 15]);
  });

  it('produces no NaN or negative values', () => {
    const configs: BetSizeConfig[] = [
      { street: 'FLOP', position: 'IP', potBb: 10, stackBb: 100 },
      { street: 'TURN', position: 'OOP', potBb: 0.5, stackBb: 100 },
      { street: 'RIVER', position: 'IP', potBb: 100, stackBb: 1 },
      { street: 'PREFLOP', position: 'OOP', potBb: 1.5, stackBb: 100 },
    ];

    for (const config of configs) {
      const sizes = getAbstractedBetSizes(config);
      expect(sizes.every((s) => Number.isFinite(s) && s > 0)).toBe(true);
    }
  });
});

describe('getAbstractedRaiseSizes', () => {
  it('computes correct raise sizes', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 7,
      stackBb: 100,
      facingBetBb: 3,
    };

    const sizes = getAbstractedRaiseSizes(config);

    // Default raise sizes: 2.2, 2.5, 3.0
    // 3 * 2.2 = 6.6 -> rounds to 6.5
    // 3 * 2.5 = 7.5
    // 3 * 3.0 = 9
    // Min raise = 3 * 2 = 6
    // All fit within stack
    expect(sizes).toEqual([6.5, 7.5, 9]);
  });

  it('includes all-in when stack is shallow relative to facing bet', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 7,
      stackBb: 9, // Stack <= 3 * facingBet (9), so all-in included
      facingBetBb: 3,
    };

    const sizes = getAbstractedRaiseSizes(config);

    // Stack (9) <= 3 * facingBet (9), so all-in included
    // Valid raises that fit: 6.5, 7.5, 9 (all <= 9)
    // All-in: 9 (equals 3x raise, so deduped)
    expect(sizes).toContain(9);
    // 9 appears once (3x raise = all-in)
    expect(sizes).toEqual([6.5, 7.5, 9]);
  });

  it('filters out raises larger than stack', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 50,
      stackBb: 20,
      facingBetBb: 10,
    };

    const sizes = getAbstractedRaiseSizes(config);

    // Raises: 10 * 2.2 = 22, doesn't fit
    // 10 * 2.5 = 25, doesn't fit
    // 10 * 3.0 = 30, doesn't fit
    // Min raise = 20, fits exactly
    // Stack <= 3 * 10 = 30, so all-in included
    // Only all-in (20) which equals min-raise
    expect(sizes).toEqual([20]);
  });

  it('enforces minimum raise requirement', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 20,
      stackBb: 100,
      facingBetBb: 10,
    };

    const sizes = getAbstractedRaiseSizes(config);

    // Min raise = 10 * 2 = 20
    // All sizes should be >= 20
    expect(sizes.every((s) => s >= 20)).toBe(true);
  });

  it('returns all-in when cannot min-raise', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 50,
      stackBb: 15,
      facingBetBb: 10,
    };

    const sizes = getAbstractedRaiseSizes(config);

    // Min raise = 20, but stack = 15
    // Can only all-in if stack > facingBet
    // 15 > 10, so all-in = 15 is valid
    expect(sizes).toEqual([15]);
  });

  it('returns empty when cannot raise at all', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 50,
      stackBb: 8,
      facingBetBb: 10,
    };

    const sizes = getAbstractedRaiseSizes(config);

    // Stack (8) <= facing (10), can't even call let alone raise
    expect(sizes).toEqual([]);
  });

  it('returns empty when no facing bet', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 100,
    };

    const sizes = getAbstractedRaiseSizes(config);
    expect(sizes).toEqual([]);
  });

  it('returns empty for zero facing bet', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 100,
      facingBetBb: 0,
    };

    const sizes = getAbstractedRaiseSizes(config);
    expect(sizes).toEqual([]);
  });

  it('handles huge facing bet', () => {
    const config: BetSizeConfig = {
      street: 'RIVER',
      position: 'IP',
      potBb: 200,
      stackBb: 50,
      facingBetBb: 100,
    };

    const sizes = getAbstractedRaiseSizes(config);

    // Can't even call (50 < 100), so can't raise
    expect(sizes).toEqual([]);
  });

  it('produces no duplicates', () => {
    const config: BetSizeConfig = {
      street: 'FLOP',
      position: 'IP',
      potBb: 10,
      stackBb: 22, // 2.2x of 10 = 22, equals all-in
      facingBetBb: 10,
    };

    const sizes = getAbstractedRaiseSizes(config);

    const uniqueCount = new Set(sizes).size;
    expect(uniqueCount).toBe(sizes.length);
  });

  it('produces no NaN or negative values', () => {
    const configs: BetSizeConfig[] = [
      { street: 'FLOP', position: 'IP', potBb: 7, stackBb: 100, facingBetBb: 3 },
      { street: 'TURN', position: 'OOP', potBb: 50, stackBb: 10, facingBetBb: 3 },
      { street: 'RIVER', position: 'IP', potBb: 200, stackBb: 150, facingBetBb: 100 },
      { street: 'PREFLOP', position: 'OOP', potBb: 1.5, stackBb: 100, facingBetBb: 1 },
    ];

    for (const config of configs) {
      const sizes = getAbstractedRaiseSizes(config);
      if (sizes.length > 0) {
        expect(sizes.every((s) => Number.isFinite(s) && s > 0)).toBe(true);
      }
    }
  });
});

describe('DEFAULT constants', () => {
  it('DEFAULT_BET_SIZES has all streets', () => {
    expect(DEFAULT_BET_SIZES).toHaveProperty('PREFLOP');
    expect(DEFAULT_BET_SIZES).toHaveProperty('FLOP');
    expect(DEFAULT_BET_SIZES).toHaveProperty('TURN');
    expect(DEFAULT_BET_SIZES).toHaveProperty('RIVER');
  });

  it('DEFAULT_RAISE_SIZES has all streets', () => {
    expect(DEFAULT_RAISE_SIZES).toHaveProperty('PREFLOP');
    expect(DEFAULT_RAISE_SIZES).toHaveProperty('FLOP');
    expect(DEFAULT_RAISE_SIZES).toHaveProperty('TURN');
    expect(DEFAULT_RAISE_SIZES).toHaveProperty('RIVER');
  });

  it('bet sizes are valid pot fractions (0-2 range)', () => {
    for (const [, sizes] of Object.entries(DEFAULT_BET_SIZES)) {
      expect(sizes.every((s) => s > 0 && s <= 2)).toBe(true);
    }
  });

  it('raise sizes are valid multiples (>= 2)', () => {
    for (const [, sizes] of Object.entries(DEFAULT_RAISE_SIZES)) {
      expect(sizes.every((s) => s >= 2)).toBe(true);
    }
  });
});

describe('toEngineActionAbstraction', () => {
  const defaultConfig: ActionAbstractionConfig = {
    betSizes: DEFAULT_BET_SIZES,
    raiseSizes: DEFAULT_RAISE_SIZES,
    includeAllIn: true,
    allInThreshold: 2.0,
  };

  it('converts solver config to engine format', () => {
    const result = toEngineActionAbstraction(defaultConfig, 'FLOP', 10, 100);

    // Should have betSizesBb, raiseSizesBb, maxRaisesPerStreet
    expect(result).toHaveProperty('betSizesBb');
    expect(result).toHaveProperty('raiseSizesBb');
    expect(result).toHaveProperty('maxRaisesPerStreet');
  });

  it('computes bet sizes correctly', () => {
    const result = toEngineActionAbstraction(defaultConfig, 'FLOP', 10, 100);

    // Default flop sizes: 0.33, 0.5, 0.75, 1.0 of 10 BB pot
    expect(result.betSizesBb).toEqual([3.5, 5, 7.5, 10]);
  });

  it('computes raise sizes when facing bet', () => {
    const result = toEngineActionAbstraction(
      defaultConfig,
      'FLOP',
      7,
      100,
      3 // facing 3 BB bet
    );

    // Default raise multiples: 2.2, 2.5, 3.0 of 3 BB facing bet
    expect(result.raiseSizesBb).toEqual([6.5, 7.5, 9]);
  });

  it('returns empty raise sizes when not facing bet', () => {
    const result = toEngineActionAbstraction(defaultConfig, 'FLOP', 10, 100);

    expect(result.raiseSizesBb).toEqual([]);
  });

  it('uses default maxRaisesPerStreet of 4', () => {
    const result = toEngineActionAbstraction(defaultConfig, 'FLOP', 10, 100);

    expect(result.maxRaisesPerStreet).toBe(4);
  });

  it('accepts custom maxRaisesPerStreet', () => {
    const result = toEngineActionAbstraction(
      defaultConfig,
      'FLOP',
      10,
      100,
      undefined,
      3
    );

    expect(result.maxRaisesPerStreet).toBe(3);
  });

  it('includes all-in for shallow stacks when enabled', () => {
    const result = toEngineActionAbstraction(defaultConfig, 'FLOP', 10, 15);

    // Stack 15 < 2 * pot 20, so all-in should be included
    expect(result.betSizesBb).toContain(15);
  });

  it('disables all-in when config says so', () => {
    const noAllInConfig: ActionAbstractionConfig = {
      ...defaultConfig,
      includeAllIn: false,
    };

    const result = toEngineActionAbstraction(noAllInConfig, 'FLOP', 10, 15);

    // Without all-in, we get standard sizes that fit in stack
    // 3.5, 5, 7.5, 10 all fit in 15
    expect(result.betSizesBb).toEqual([3.5, 5, 7.5, 10]);
  });

  it('handles edge cases without errors', () => {
    // Tiny pot
    const tinyPot = toEngineActionAbstraction(defaultConfig, 'TURN', 0.5, 100);
    expect(tinyPot.betSizesBb.every((s) => Number.isFinite(s) && s > 0)).toBe(
      true
    );

    // Tiny stack
    const tinyStack = toEngineActionAbstraction(defaultConfig, 'RIVER', 100, 1);
    expect(tinyStack.betSizesBb).toEqual([1]);
  });
});
