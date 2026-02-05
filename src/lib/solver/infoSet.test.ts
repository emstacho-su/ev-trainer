// src/lib/solver/infoSet.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InfoSetStore,
  createInfoSet,
  getAverageStrategy,
  getCurrentStrategy,
} from './infoSet';

describe('createInfoSet', () => {
  it('creates info set with zero-initialized Float64Arrays', () => {
    const infoSet = createInfoSet('test', ['FOLD', 'CALL', 'RAISE']);

    expect(infoSet.infoSetId).toBe('test');
    expect(infoSet.numActions).toBe(3);
    expect(infoSet.actions).toEqual(['FOLD', 'CALL', 'RAISE']);

    // Verify Float64Array types
    expect(infoSet.regretSum.constructor.name).toBe('Float64Array');
    expect(infoSet.strategySum.constructor.name).toBe('Float64Array');

    // Verify zero initialization
    expect(Array.from(infoSet.regretSum)).toEqual([0, 0, 0]);
    expect(Array.from(infoSet.strategySum)).toEqual([0, 0, 0]);
  });

  it('creates correct array sizes for different action counts', () => {
    const twoActions = createInfoSet('two', ['CHECK', 'BET']);
    expect(twoActions.numActions).toBe(2);
    expect(twoActions.regretSum.length).toBe(2);

    const fiveActions = createInfoSet('five', ['FOLD', 'CALL', 'RAISE_2X', 'RAISE_3X', 'ALL_IN']);
    expect(fiveActions.numActions).toBe(5);
    expect(fiveActions.regretSum.length).toBe(5);
  });
});

describe('getAverageStrategy', () => {
  it('returns uniform distribution when no training data', () => {
    const infoSet = createInfoSet('test', ['FOLD', 'CALL', 'RAISE']);

    const strategy = getAverageStrategy(infoSet);

    expect(strategy.length).toBe(3);
    expect(strategy[0]).toBeCloseTo(1 / 3);
    expect(strategy[1]).toBeCloseTo(1 / 3);
    expect(strategy[2]).toBeCloseTo(1 / 3);
  });

  it('returns uniform for very small sums (below threshold)', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);
    infoSet.strategySum[0] = 1e-10;
    infoSet.strategySum[1] = 1e-11;

    const strategy = getAverageStrategy(infoSet);

    expect(strategy[0]).toBeCloseTo(0.5);
    expect(strategy[1]).toBeCloseTo(0.5);
  });

  it('normalizes correctly with accumulated data', () => {
    const infoSet = createInfoSet('test', ['FOLD', 'CALL', 'RAISE']);
    infoSet.strategySum[0] = 100; // FOLD
    infoSet.strategySum[1] = 200; // CALL
    infoSet.strategySum[2] = 100; // RAISE

    const strategy = getAverageStrategy(infoSet);

    expect(strategy[0]).toBeCloseTo(0.25); // 100/400
    expect(strategy[1]).toBeCloseTo(0.5); // 200/400
    expect(strategy[2]).toBeCloseTo(0.25); // 100/400
    expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
  });

  it('handles skewed distributions', () => {
    const infoSet = createInfoSet('test', ['A', 'B', 'C']);
    infoSet.strategySum[0] = 1000;
    infoSet.strategySum[1] = 1;
    infoSet.strategySum[2] = 0;

    const strategy = getAverageStrategy(infoSet);

    expect(strategy[0]).toBeCloseTo(1000 / 1001);
    expect(strategy[1]).toBeCloseTo(1 / 1001);
    expect(strategy[2]).toBeCloseTo(0);
    expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
  });
});

describe('getCurrentStrategy', () => {
  it('returns uniform distribution when regrets are zero', () => {
    const infoSet = createInfoSet('test', ['FOLD', 'CALL', 'RAISE']);

    const strategy = getCurrentStrategy(infoSet);

    expect(strategy.length).toBe(3);
    expect(strategy[0]).toBeCloseTo(1 / 3);
    expect(strategy[1]).toBeCloseTo(1 / 3);
    expect(strategy[2]).toBeCloseTo(1 / 3);
  });

  it('clips negative regrets to zero in calculation', () => {
    const infoSet = createInfoSet('test', ['A', 'B', 'C']);
    infoSet.regretSum[0] = -1; // Negative, treated as 0
    infoSet.regretSum[1] = 2;
    infoSet.regretSum[2] = 1;

    const strategy = getCurrentStrategy(infoSet);

    // Only positive regrets contribute: 0 + 2 + 1 = 3
    expect(strategy[0]).toBeCloseTo(0); // -1 clipped to 0
    expect(strategy[1]).toBeCloseTo(2 / 3);
    expect(strategy[2]).toBeCloseTo(1 / 3);
    expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
  });

  it('returns uniform when all regrets are negative', () => {
    const infoSet = createInfoSet('test', ['A', 'B']);
    infoSet.regretSum[0] = -5;
    infoSet.regretSum[1] = -3;

    const strategy = getCurrentStrategy(infoSet);

    expect(strategy[0]).toBeCloseTo(0.5);
    expect(strategy[1]).toBeCloseTo(0.5);
  });

  it('concentrates on single action when only one positive regret', () => {
    const infoSet = createInfoSet('test', ['FOLD', 'CALL', 'RAISE']);
    infoSet.regretSum[0] = 0;
    infoSet.regretSum[1] = 5;
    infoSet.regretSum[2] = 0;

    const strategy = getCurrentStrategy(infoSet);

    expect(strategy[0]).toBe(0);
    expect(strategy[1]).toBe(1);
    expect(strategy[2]).toBe(0);
  });

  it('produces valid probability distribution (no NaN)', () => {
    const infoSet = createInfoSet('test', ['A', 'B', 'C', 'D']);

    // Edge case: very small positive regret
    infoSet.regretSum[0] = 1e-15;
    infoSet.regretSum[1] = 0;
    infoSet.regretSum[2] = 0;
    infoSet.regretSum[3] = 0;

    const strategy = getCurrentStrategy(infoSet);

    // Should return uniform since sum is below threshold
    expect(strategy.every(p => !Number.isNaN(p))).toBe(true);
    expect(strategy.reduce((a, b) => a + b)).toBeCloseTo(1.0);
  });
});

describe('InfoSetStore', () => {
  let store: InfoSetStore;

  beforeEach(() => {
    store = new InfoSetStore();
  });

  describe('getOrCreate', () => {
    it('creates new info set on first call', () => {
      const infoSet = store.getOrCreate('test', ['A', 'B']);

      expect(infoSet.infoSetId).toBe('test');
      expect(infoSet.numActions).toBe(2);
      expect(store.size).toBe(1);
    });

    it('returns same instance on second call', () => {
      const first = store.getOrCreate('test', ['A', 'B']);
      first.regretSum[0] = 100; // Modify to verify identity

      const second = store.getOrCreate('test', ['A', 'B']);

      expect(second).toBe(first); // Same object reference
      expect(second.regretSum[0]).toBe(100); // Modified value persists
    });

    it('creates separate info sets for different IDs', () => {
      const first = store.getOrCreate('one', ['A']);
      const second = store.getOrCreate('two', ['B', 'C']);

      expect(store.size).toBe(2);
      expect(first.numActions).toBe(1);
      expect(second.numActions).toBe(2);
    });
  });

  describe('has', () => {
    it('returns false for non-existent info set', () => {
      expect(store.has('nonexistent')).toBe(false);
    });

    it('returns true for existing info set', () => {
      store.getOrCreate('exists', ['A']);
      expect(store.has('exists')).toBe(true);
    });
  });

  describe('get', () => {
    it('throws for non-existent info set', () => {
      expect(() => store.get('nonexistent')).toThrow('InfoSet not found: nonexistent');
    });

    it('returns existing info set', () => {
      const created = store.getOrCreate('test', ['A', 'B']);
      const retrieved = store.get('test');
      expect(retrieved).toBe(created);
    });
  });

  describe('getAverageStrategy', () => {
    it('returns uniform when no training data', () => {
      store.getOrCreate('test', ['A', 'B', 'C']);

      const strategy = store.getAverageStrategy('test');

      expect(strategy[0]).toBeCloseTo(1 / 3);
      expect(strategy[1]).toBeCloseTo(1 / 3);
      expect(strategy[2]).toBeCloseTo(1 / 3);
    });

    it('normalizes correctly after updates', () => {
      const infoSet = store.getOrCreate('test', ['FOLD', 'CALL']);
      infoSet.strategySum[0] = 30;
      infoSet.strategySum[1] = 70;

      const strategy = store.getAverageStrategy('test');

      expect(strategy[0]).toBeCloseTo(0.3);
      expect(strategy[1]).toBeCloseTo(0.7);
    });
  });

  describe('getCurrentStrategy', () => {
    it('returns uniform when regrets are zero', () => {
      store.getOrCreate('test', ['A', 'B']);

      const strategy = store.getCurrentStrategy('test');

      expect(strategy[0]).toBeCloseTo(0.5);
      expect(strategy[1]).toBeCloseTo(0.5);
    });

    it('uses regret matching correctly', () => {
      const infoSet = store.getOrCreate('test', ['A', 'B', 'C']);
      infoSet.regretSum[0] = 10;
      infoSet.regretSum[1] = 20;
      infoSet.regretSum[2] = 10;

      const strategy = store.getCurrentStrategy('test');

      expect(strategy[0]).toBeCloseTo(0.25);
      expect(strategy[1]).toBeCloseTo(0.5);
      expect(strategy[2]).toBeCloseTo(0.25);
    });
  });

  describe('size', () => {
    it('starts at zero', () => {
      expect(store.size).toBe(0);
    });

    it('increments with new info sets', () => {
      store.getOrCreate('one', ['A']);
      expect(store.size).toBe(1);

      store.getOrCreate('two', ['B']);
      expect(store.size).toBe(2);

      // Same ID doesn't increment
      store.getOrCreate('one', ['A']);
      expect(store.size).toBe(2);
    });
  });

  describe('entries', () => {
    it('iterates over all stored info sets', () => {
      store.getOrCreate('one', ['A']);
      store.getOrCreate('two', ['B', 'C']);
      store.getOrCreate('three', ['X', 'Y', 'Z']);

      const entries = Array.from(store.entries());

      expect(entries.length).toBe(3);
      expect(entries.map(([id]) => id).sort()).toEqual(['one', 'three', 'two']);
    });

    it('returns empty iterator for empty store', () => {
      const entries = Array.from(store.entries());
      expect(entries.length).toBe(0);
    });
  });

  describe('clear', () => {
    it('removes all info sets', () => {
      store.getOrCreate('one', ['A']);
      store.getOrCreate('two', ['B']);
      expect(store.size).toBe(2);

      store.clear();

      expect(store.size).toBe(0);
      expect(store.has('one')).toBe(false);
      expect(store.has('two')).toBe(false);
    });
  });

  describe('memory optimization', () => {
    it('uses Float64Array for numeric storage', () => {
      const infoSet = store.getOrCreate('test', ['A', 'B', 'C']);

      expect(infoSet.regretSum.constructor.name).toBe('Float64Array');
      expect(infoSet.strategySum.constructor.name).toBe('Float64Array');
    });

    it('uses Map for store (O(1) lookup)', () => {
      // Create many info sets to verify Map performance
      for (let i = 0; i < 1000; i++) {
        store.getOrCreate(`infoset_${i}`, ['A', 'B']);
      }

      // Verify we can retrieve any of them quickly
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        store.get(`infoset_${i}`);
      }
      const elapsed = performance.now() - start;

      // 1000 lookups should be fast (< 50ms is very conservative)
      expect(elapsed).toBeLessThan(50);
      expect(store.size).toBe(1000);
    });
  });
});
