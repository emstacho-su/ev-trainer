// src/lib/solver/cfr.test.ts
import { describe, it, expect } from 'vitest';
import {
  regretMatching,
  updateRegrets,
  updateStrategySum,
  validateStrategy,
  DEFAULT_CFR_CONFIG,
} from './cfr';
import { createInfoSet } from './infoSet';

describe('regretMatching', () => {
  it('returns uniform distribution when all regrets are zero', () => {
    const regretSum = new Float64Array([0, 0, 0]);

    const strategy = regretMatching(regretSum);

    expect(strategy.length).toBe(3);
    expect(strategy[0]).toBeCloseTo(1 / 3);
    expect(strategy[1]).toBeCloseTo(1 / 3);
    expect(strategy[2]).toBeCloseTo(1 / 3);
  });

  it('concentrates on single action with [1, 0, 0]', () => {
    const regretSum = new Float64Array([1, 0, 0]);

    const strategy = regretMatching(regretSum);

    expect(strategy[0]).toBe(1);
    expect(strategy[1]).toBe(0);
    expect(strategy[2]).toBe(0);
  });

  it('clips negative regrets: [-1, 2, 1] returns [0, 2/3, 1/3]', () => {
    const regretSum = new Float64Array([-1, 2, 1]);

    const strategy = regretMatching(regretSum);

    expect(strategy[0]).toBeCloseTo(0); // -1 clipped to 0
    expect(strategy[1]).toBeCloseTo(2 / 3);
    expect(strategy[2]).toBeCloseTo(1 / 3);
    expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
  });

  it('returns equal probabilities for [0.5, 0.5]', () => {
    const regretSum = new Float64Array([0.5, 0.5]);

    const strategy = regretMatching(regretSum);

    expect(strategy[0]).toBeCloseTo(0.5);
    expect(strategy[1]).toBeCloseTo(0.5);
  });

  it('returns uniform when all regrets are negative', () => {
    const regretSum = new Float64Array([-5, -3, -1]);

    const strategy = regretMatching(regretSum);

    expect(strategy[0]).toBeCloseTo(1 / 3);
    expect(strategy[1]).toBeCloseTo(1 / 3);
    expect(strategy[2]).toBeCloseTo(1 / 3);
  });

  it('handles large values without overflow', () => {
    const regretSum = new Float64Array([1e10, 2e10, 1e10]);

    const strategy = regretMatching(regretSum);

    expect(strategy[0]).toBeCloseTo(0.25);
    expect(strategy[1]).toBeCloseTo(0.5);
    expect(strategy[2]).toBeCloseTo(0.25);
  });

  it('handles very small positive values', () => {
    const regretSum = new Float64Array([1e-8, 2e-8]);

    const strategy = regretMatching(regretSum);

    expect(strategy[0]).toBeCloseTo(1 / 3);
    expect(strategy[1]).toBeCloseTo(2 / 3);
    expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
  });

  it('produces valid probability distribution (no NaN)', () => {
    const regretSum = new Float64Array([0, 0, 0, 0]);

    const strategy = regretMatching(regretSum);

    expect(strategy.every(p => !Number.isNaN(p))).toBe(true);
    expect(strategy.every(p => p >= 0 && p <= 1)).toBe(true);
    expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
  });
});

describe('updateRegrets', () => {
  it('accumulates positive regret correctly', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);

    // Action A: value 10, Action B: value 5
    // Node value (weighted average): 7.5 (with 50/50 strategy)
    // Instant regrets: A = 10 - 7.5 = 2.5, B = 5 - 7.5 = -2.5
    // With opponent reach 1.0: CF regrets same as instant
    updateRegrets(infoSet, [10, 5], 7.5, 1.0);

    expect(infoSet.regretSum[0]).toBeCloseTo(2.5);
    expect(infoSet.regretSum[1]).toBeCloseTo(0); // CFR+ floor: -2.5 -> 0
  });

  it('applies counterfactual weighting by opponent reach', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);

    // Same values as above but with 0.5 opponent reach
    updateRegrets(infoSet, [10, 5], 7.5, 0.5);

    expect(infoSet.regretSum[0]).toBeCloseTo(1.25); // 2.5 * 0.5
    expect(infoSet.regretSum[1]).toBeCloseTo(0); // -2.5 * 0.5 = -1.25 -> 0
  });

  it('floors regrets at 0 AFTER accumulation (CFR+ test)', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);

    // Start with some positive regret
    infoSet.regretSum[0] = 0.1;
    infoSet.regretSum[1] = 0.1;

    // Action values that will make A get negative instant regret
    // A: value 0, B: value 1, node value 0.5
    // A: 0 - 0.5 = -0.5, B: 1 - 0.5 = 0.5
    updateRegrets(infoSet, [0, 1], 0.5, 1.0);

    // A: 0.1 + (-0.5) = -0.4 -> floored to 0
    // B: 0.1 + 0.5 = 0.6
    expect(infoSet.regretSum[0]).toBe(0); // Floored, not -0.4
    expect(infoSet.regretSum[1]).toBeCloseTo(0.6);
  });

  it('CFR+ floor: regret 0.1 + instant -0.3 = 0 (not -0.2)', () => {
    const infoSet = createInfoSet('test', ['X']);
    infoSet.regretSum[0] = 0.1;

    // Instant regret will be -0.3 (action value 0, node value 0.3)
    updateRegrets(infoSet, [0], 0.3, 1.0);

    // 0.1 + (-0.3) = -0.2, but floored to 0
    expect(infoSet.regretSum[0]).toBe(0);
  });

  it('accumulates over multiple updates', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);

    // First update: A gets positive regret
    updateRegrets(infoSet, [10, 5], 7.5, 1.0);
    expect(infoSet.regretSum[0]).toBeCloseTo(2.5);

    // Second update: A gets more positive regret
    updateRegrets(infoSet, [8, 6], 7.0, 1.0);
    // New instant: A = 8 - 7 = 1, B = 6 - 7 = -1
    expect(infoSet.regretSum[0]).toBeCloseTo(3.5); // 2.5 + 1.0
    expect(infoSet.regretSum[1]).toBe(0); // 0 + (-1) -> 0
  });

  it('throws on mismatched action count', () => {
    const infoSet = createInfoSet('test', ['A', 'B', 'C']);

    expect(() => updateRegrets(infoSet, [1, 2], 1.5, 1.0)).toThrow(
      "Action values length (2) doesn't match numActions (3)"
    );
  });
});

describe('updateStrategySum', () => {
  it('accumulates strategy with reach weighting', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);

    updateStrategySum(infoSet, [0.6, 0.4], 1.0);

    expect(infoSet.strategySum[0]).toBeCloseTo(0.6);
    expect(infoSet.strategySum[1]).toBeCloseTo(0.4);
  });

  it('applies current reach weighting', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);

    updateStrategySum(infoSet, [0.6, 0.4], 0.5);

    expect(infoSet.strategySum[0]).toBeCloseTo(0.3); // 0.6 * 0.5
    expect(infoSet.strategySum[1]).toBeCloseTo(0.2); // 0.4 * 0.5
  });

  it('accumulates over multiple updates', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);

    updateStrategySum(infoSet, [0.6, 0.4], 1.0);
    updateStrategySum(infoSet, [0.8, 0.2], 1.0);

    expect(infoSet.strategySum[0]).toBeCloseTo(1.4); // 0.6 + 0.8
    expect(infoSet.strategySum[1]).toBeCloseTo(0.6); // 0.4 + 0.2
  });

  it('throws on mismatched strategy length', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);

    expect(() => updateStrategySum(infoSet, [0.5, 0.3, 0.2], 1.0)).toThrow(
      "Strategy length (3) doesn't match numActions (2)"
    );
  });
});

describe('validateStrategy', () => {
  it('accepts valid uniform distribution', () => {
    expect(() => validateStrategy([0.5, 0.5])).not.toThrow();
    expect(() => validateStrategy([1 / 3, 1 / 3, 1 / 3])).not.toThrow();
  });

  it('accepts valid skewed distribution', () => {
    expect(() => validateStrategy([0.9, 0.1])).not.toThrow();
    expect(() => validateStrategy([1, 0])).not.toThrow();
    expect(() => validateStrategy([0, 0, 1])).not.toThrow();
  });

  it('throws on empty array', () => {
    expect(() => validateStrategy([])).toThrow('Strategy must be a non-empty array');
  });

  it('throws on negative probability', () => {
    expect(() => validateStrategy([-0.1, 1.1])).toThrow('negative probability');
  });

  it('throws on probability > 1', () => {
    expect(() => validateStrategy([1.5, -0.5])).toThrow();
  });

  it('throws on NaN', () => {
    expect(() => validateStrategy([NaN, 0.5])).toThrow('invalid value');
  });

  it('throws when sum is not 1.0', () => {
    expect(() => validateStrategy([0.4, 0.4])).toThrow('sum to 0.8');
    expect(() => validateStrategy([0.6, 0.6])).toThrow('sum to 1.2');
  });

  it('allows small floating point errors', () => {
    // Sum is 0.9999999999999999 due to floating point
    expect(() => validateStrategy([0.1, 0.2, 0.3, 0.4])).not.toThrow();
  });
});

describe('DEFAULT_CFR_CONFIG', () => {
  it('has reasonable defaults', () => {
    expect(DEFAULT_CFR_CONFIG.maxIterations).toBe(1_000_000);
    expect(DEFAULT_CFR_CONFIG.targetExploitability).toBe(0.1);
    expect(DEFAULT_CFR_CONFIG.checkConvergenceEvery).toBe(10_000);
  });

  it('does not include progress callback by default', () => {
    expect(DEFAULT_CFR_CONFIG.progressCallback).toBeUndefined();
  });
});

describe('integration: regretMatching + updateRegrets', () => {
  it('cycle produces valid strategy after updates', () => {
    const infoSet = createInfoSet('test', ['FOLD', 'CALL', 'RAISE']);

    // Simulate CFR iteration
    for (let i = 0; i < 10; i++) {
      // Get current strategy
      const strategy = regretMatching(infoSet.regretSum);
      expect(() => validateStrategy(strategy)).not.toThrow();

      // Simulate action values (CALL is best)
      const actionValues = [0, 1, 0.5];
      const nodeValue =
        strategy[0] * actionValues[0] +
        strategy[1] * actionValues[1] +
        strategy[2] * actionValues[2];

      // Update regrets
      updateRegrets(infoSet, actionValues, nodeValue, 1.0);

      // Update strategy sum
      updateStrategySum(infoSet, strategy, 1.0);
    }

    // Final strategy should favor CALL
    const finalStrategy = regretMatching(infoSet.regretSum);
    expect(() => validateStrategy(finalStrategy)).not.toThrow();
    expect(finalStrategy[1]).toBeGreaterThan(finalStrategy[0]); // CALL > FOLD
    expect(finalStrategy[1]).toBeGreaterThan(finalStrategy[2]); // CALL > RAISE
  });

  it('handles zero-regret edge case throughout cycle', () => {
    const infoSet = createInfoSet('test', ['A', 'B', 'C']);

    // All actions have equal value
    for (let i = 0; i < 5; i++) {
      const strategy = regretMatching(infoSet.regretSum);
      expect(() => validateStrategy(strategy)).not.toThrow();
      expect(strategy.every(p => !Number.isNaN(p))).toBe(true);

      // Equal action values -> zero instant regrets
      updateRegrets(infoSet, [1, 1, 1], 1, 1.0);
      updateStrategySum(infoSet, strategy, 1.0);
    }

    // Should still have valid strategy
    const final = regretMatching(infoSet.regretSum);
    expect(final.reduce((a, b) => a + b)).toBeCloseTo(1.0);
  });
});
