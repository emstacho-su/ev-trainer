// src/__tests__/determinismComprehensive.test.ts
// Comprehensive determinism tests for RNG-based session generation.

import { describe, it, expect } from 'vitest';
import { createSeededRng, combineSeed } from '../lib/engine/rng';

describe('session determinism', () => {
  describe('same seed + same config produces same sequence', () => {
    it('same seed produces identical next() sequence', () => {
      const rng1 = createSeededRng('test-seed-42');
      const rng2 = createSeededRng('test-seed-42');

      const seq1 = Array.from({ length: 100 }, () => rng1.next());
      const seq2 = Array.from({ length: 100 }, () => rng2.next());

      expect(seq1).toEqual(seq2);
    });

    it('same seed produces identical nextUint32() sequence', () => {
      const rng1 = createSeededRng('determinism-check');
      const rng2 = createSeededRng('determinism-check');

      const seq1 = Array.from({ length: 50 }, () => rng1.nextUint32());
      const seq2 = Array.from({ length: 50 }, () => rng2.nextUint32());

      expect(seq1).toEqual(seq2);
    });

    it('combineSeed + createSeededRng is deterministic', () => {
      const seed1 = combineSeed(['session', 42, 'preflop']);
      const seed2 = combineSeed(['session', 42, 'preflop']);

      expect(seed1).toBe(seed2);

      const rng1 = createSeededRng(seed1);
      const rng2 = createSeededRng(seed2);

      const seq1 = Array.from({ length: 20 }, () => rng1.next());
      const seq2 = Array.from({ length: 20 }, () => rng2.next());

      expect(seq1).toEqual(seq2);
    });

    it('state() is identical at every step for same seed', () => {
      const rng1 = createSeededRng('state-check');
      const rng2 = createSeededRng('state-check');

      for (let i = 0; i < 50; i++) {
        expect(rng1.state()).toBe(rng2.state());
        rng1.next();
        rng2.next();
      }
    });
  });

  describe('different seeds produce different sequences', () => {
    it('different string seeds give different values', () => {
      const rng1 = createSeededRng('seed-alpha');
      const rng2 = createSeededRng('seed-beta');

      const seq1 = Array.from({ length: 20 }, () => rng1.next());
      const seq2 = Array.from({ length: 20 }, () => rng2.next());

      expect(seq1).not.toEqual(seq2);
    });

    it('numerically close seeds produce different sequences', () => {
      const rng1 = createSeededRng('seed-1');
      const rng2 = createSeededRng('seed-2');

      const val1 = rng1.next();
      const val2 = rng2.next();

      expect(val1).not.toBe(val2);
    });

    it('different combineSeed parts produce different output', () => {
      const seedA = combineSeed(['session', 1, 'filter-A']);
      const seedB = combineSeed(['session', 1, 'filter-B']);

      expect(seedA).not.toBe(seedB);

      const rngA = createSeededRng(seedA);
      const rngB = createSeededRng(seedB);

      const seqA = Array.from({ length: 20 }, () => rngA.next());
      const seqB = Array.from({ length: 20 }, () => rngB.next());

      expect(seqA).not.toEqual(seqB);
    });
  });

  describe('same seed + different filters produce different sequences', () => {
    it('changing filter component changes the RNG sequence', () => {
      const seedPreflop = combineSeed(['my-seed', 'PREFLOP']);
      const seedFlop = combineSeed(['my-seed', 'FLOP']);

      expect(seedPreflop).not.toBe(seedFlop);

      const rng1 = createSeededRng(seedPreflop);
      const rng2 = createSeededRng(seedFlop);

      const seq1 = Array.from({ length: 20 }, () => rng1.next());
      const seq2 = Array.from({ length: 20 }, () => rng2.next());

      expect(seq1).not.toEqual(seq2);
    });

    it('different position filters produce different sequences', () => {
      const seedBTN = combineSeed(['session-x', 'BTN']);
      const seedSB = combineSeed(['session-x', 'SB']);

      const rng1 = createSeededRng(seedBTN);
      const rng2 = createSeededRng(seedSB);

      expect(rng1.next()).not.toBe(rng2.next());
    });
  });

  describe('RNG output properties', () => {
    it('next() always returns values in [0, 1)', () => {
      const rng = createSeededRng('range-check');

      for (let i = 0; i < 1000; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('nextUint32() returns integers in [0, 2^32)', () => {
      const rng = createSeededRng('uint32-check');

      for (let i = 0; i < 1000; i++) {
        const val = rng.nextUint32();
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(2 ** 32);
      }
    });

    it('produces reasonable distribution (not all same value)', () => {
      const rng = createSeededRng('distribution-check');
      const values = Array.from({ length: 100 }, () => rng.next());
      const unique = new Set(values);

      // With 100 draws, we should have many unique values
      expect(unique.size).toBeGreaterThan(90);
    });
  });

  describe('combineSeed edge cases', () => {
    it('order of parts matters', () => {
      const seed1 = combineSeed(['a', 'b', 'c']);
      const seed2 = combineSeed(['c', 'b', 'a']);
      expect(seed1).not.toBe(seed2);
    });

    it('number vs string representation produces same seed', () => {
      // combineSeed converts numbers to strings with String()
      const seed1 = combineSeed([42]);
      const seed2 = combineSeed(['42']);
      // Both should produce "42" since String(42) === "42"
      expect(seed1).toBe(seed2);
    });

    it('throws for empty parts array', () => {
      expect(() => combineSeed([])).toThrow('non-empty');
    });
  });

  describe('createSeededRng validation', () => {
    it('throws for empty string seed', () => {
      expect(() => createSeededRng('')).toThrow('non-empty string');
    });
  });
});
