// src/lib/solver/cfr.convergence.test.ts
// CFR+ numerical property and convergence tests.

import { describe, it, expect } from 'vitest';
import {
  regretMatching,
  updateRegrets,
  updateStrategySum,
  validateStrategy,
} from './cfr';
import { createInfoSet } from './infoSet';

describe('CFR+ numerical properties', () => {
  describe('regretMatching with all zeros', () => {
    it('returns uniform distribution for 2 actions', () => {
      const strategy = regretMatching(new Float64Array([0, 0]));
      expect(strategy).toEqual([0.5, 0.5]);
    });

    it('returns uniform distribution for 3 actions', () => {
      const strategy = regretMatching(new Float64Array([0, 0, 0]));
      expect(strategy[0]).toBeCloseTo(1 / 3);
      expect(strategy[1]).toBeCloseTo(1 / 3);
      expect(strategy[2]).toBeCloseTo(1 / 3);
    });

    it('returns uniform distribution for 5 actions', () => {
      const strategy = regretMatching(new Float64Array(5));
      for (const p of strategy) {
        expect(p).toBeCloseTo(0.2);
      }
    });
  });

  describe('regretMatching with one positive regret', () => {
    it('concentrates entirely on the positive action', () => {
      const strategy = regretMatching(new Float64Array([0, 0, 10]));
      expect(strategy[0]).toBe(0);
      expect(strategy[1]).toBe(0);
      expect(strategy[2]).toBe(1);
    });

    it('single positive among zeros gets 100%', () => {
      const strategy = regretMatching(new Float64Array([5, 0, 0, 0]));
      expect(strategy[0]).toBe(1);
      expect(strategy[1]).toBe(0);
      expect(strategy[2]).toBe(0);
      expect(strategy[3]).toBe(0);
    });
  });

  describe('regretMatching floors negative regrets to zero', () => {
    it('negative regrets treated as zero in distribution', () => {
      // [-5, 10, -3] -> positive only: [0, 10, 0] -> [0, 1, 0]
      const strategy = regretMatching(new Float64Array([-5, 10, -3]));
      expect(strategy[0]).toBe(0);
      expect(strategy[1]).toBe(1);
      expect(strategy[2]).toBe(0);
    });

    it('all negative regrets produce uniform', () => {
      const strategy = regretMatching(new Float64Array([-10, -5, -1]));
      expect(strategy[0]).toBeCloseTo(1 / 3);
      expect(strategy[1]).toBeCloseTo(1 / 3);
      expect(strategy[2]).toBeCloseTo(1 / 3);
    });

    it('mixed positive and negative distributes proportionally among positives', () => {
      // [-1, 2, 1] -> positives: [0, 2, 1] -> [0, 2/3, 1/3]
      const strategy = regretMatching(new Float64Array([-1, 2, 1]));
      expect(strategy[0]).toBeCloseTo(0);
      expect(strategy[1]).toBeCloseTo(2 / 3);
      expect(strategy[2]).toBeCloseTo(1 / 3);
    });
  });

  describe('regretMatching always produces valid distributions', () => {
    it('output sums to 1.0', () => {
      const cases = [
        new Float64Array([0, 0, 0]),
        new Float64Array([1, 2, 3]),
        new Float64Array([-1, -2, -3]),
        new Float64Array([100, 0, 0]),
        new Float64Array([1e-10, 1e-10]),
      ];

      for (const regrets of cases) {
        const strategy = regretMatching(regrets);
        const sum = strategy.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0);
      }
    });

    it('no negative probabilities', () => {
      const strategy = regretMatching(new Float64Array([-100, 50, -200, 1]));
      for (const p of strategy) {
        expect(p).toBeGreaterThanOrEqual(0);
      }
    });

    it('no NaN values', () => {
      const strategy = regretMatching(new Float64Array([0, 0]));
      for (const p of strategy) {
        expect(Number.isNaN(p)).toBe(false);
      }
    });
  });

  describe('validateStrategy rejects invalid distributions', () => {
    it('rejects empty array', () => {
      expect(() => validateStrategy([])).toThrow('non-empty');
    });

    it('rejects negative probabilities', () => {
      expect(() => validateStrategy([-0.5, 1.5])).toThrow('negative');
    });

    it('rejects sum != 1', () => {
      expect(() => validateStrategy([0.3, 0.3])).toThrow();
    });

    it('rejects NaN values', () => {
      expect(() => validateStrategy([NaN, 0.5, 0.5])).toThrow('invalid');
    });

    it('rejects probability > 1', () => {
      expect(() => validateStrategy([1.5])).toThrow();
    });

    it('accepts valid distributions', () => {
      expect(() => validateStrategy([1])).not.toThrow();
      expect(() => validateStrategy([0.5, 0.5])).not.toThrow();
      expect(() => validateStrategy([0.25, 0.25, 0.25, 0.25])).not.toThrow();
      expect(() => validateStrategy([0, 0, 1])).not.toThrow();
    });
  });

  describe('CFR+ convergence behavior', () => {
    it('converges toward best action over many iterations', () => {
      const infoSet = createInfoSet('convergence-test', ['FOLD', 'CALL', 'RAISE']);

      // Simulate 100 iterations where CALL is always best
      for (let i = 0; i < 100; i++) {
        const strategy = regretMatching(infoSet.regretSum);
        const actionValues = [-1, 2, 0.5]; // CALL = 2 is always best
        const nodeValue =
          strategy[0] * actionValues[0] +
          strategy[1] * actionValues[1] +
          strategy[2] * actionValues[2];

        updateRegrets(infoSet, actionValues, nodeValue, 1.0);
        updateStrategySum(infoSet, strategy, 1.0);
      }

      const finalStrategy = regretMatching(infoSet.regretSum);
      expect(() => validateStrategy(finalStrategy)).not.toThrow();

      // CALL should dominate
      expect(finalStrategy[1]).toBeGreaterThan(0.5);
      expect(finalStrategy[1]).toBeGreaterThan(finalStrategy[0]);
      expect(finalStrategy[1]).toBeGreaterThan(finalStrategy[2]);
    });

    it('equal action values maintain near-uniform distribution', () => {
      const infoSet = createInfoSet('equal-test', ['A', 'B', 'C']);

      for (let i = 0; i < 50; i++) {
        const strategy = regretMatching(infoSet.regretSum);
        // All actions equally good -> zero instant regrets
        updateRegrets(infoSet, [1, 1, 1], 1, 1.0);
        updateStrategySum(infoSet, strategy, 1.0);
      }

      const finalStrategy = regretMatching(infoSet.regretSum);
      // With equal values, regrets stay at 0, so uniform distribution
      for (const p of finalStrategy) {
        expect(p).toBeCloseTo(1 / 3, 1);
      }
    });

    it('CFR+ floors prevent negative regret accumulation', () => {
      const infoSet = createInfoSet('floor-test', ['A', 'B']);

      // Many iterations where A is always worse
      for (let i = 0; i < 20; i++) {
        updateRegrets(infoSet, [0, 10], 5, 1.0);
      }

      // A's regret should be 0 (floored), not -100
      expect(infoSet.regretSum[0]).toBe(0);
      // B's regret should be accumulated positively
      expect(infoSet.regretSum[1]).toBeGreaterThan(0);
    });
  });

  describe('numerical stability edge cases', () => {
    it('handles very large regret values', () => {
      const strategy = regretMatching(new Float64Array([1e15, 2e15]));
      expect(strategy[0]).toBeCloseTo(1 / 3);
      expect(strategy[1]).toBeCloseTo(2 / 3);
      expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
    });

    it('handles very small positive regrets', () => {
      const strategy = regretMatching(new Float64Array([1e-8, 2e-8]));
      expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
    });

    it('single action always returns [1]', () => {
      const strategy = regretMatching(new Float64Array([0]));
      expect(strategy).toEqual([1]);
    });

    it('single action with large regret returns [1]', () => {
      const strategy = regretMatching(new Float64Array([1e12]));
      expect(strategy).toEqual([1]);
    });
  });
});
