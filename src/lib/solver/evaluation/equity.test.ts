// src/lib/solver/evaluation/equity.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Hand, CanonicalHand } from '../types';
import {
  calculatePreflopEquityMonteCarlo,
  calculateCanonicalEquity,
  getEquityIndex,
  NUM_CANONICAL_HANDS,
  setPreflopEquityTable,
  calculatePreflopEquityFromTable,
  clearEquityTable,
  isEquityTableLoaded,
} from './equity';
import { CANONICAL_HANDS } from '../abstraction/cards';

describe('Preflop Equity Calculation', () => {
  afterEach(() => {
    clearEquityTable();
  });

  describe('calculatePreflopEquityMonteCarlo', () => {
    it('calculates AA vs KK equity ~82%', () => {
      const aa: Hand = ['Ah', 'Ad'];
      const kk: Hand = ['Kc', 'Ks'];

      const equity = calculatePreflopEquityMonteCarlo(aa, kk, 5000);

      // AA vs KK should be ~82% for AA
      expect(equity).toBeGreaterThan(0.78);
      expect(equity).toBeLessThan(0.86);
    });

    it('calculates AKs vs AKo equity ~50%', () => {
      const aks: Hand = ['Ah', 'Kh'];
      const ako: Hand = ['Ac', 'Kd'];

      const equity = calculatePreflopEquityMonteCarlo(aks, ako, 5000);

      // AKs vs AKo should be close to 50% (slight edge to suited)
      expect(equity).toBeGreaterThan(0.48);
      expect(equity).toBeLessThan(0.56);
    });

    it('calculates 72o vs AA equity ~12%', () => {
      const seventy_two: Hand = ['7h', '2c'];
      const aa: Hand = ['As', 'Ad'];

      const equity = calculatePreflopEquityMonteCarlo(seventy_two, aa, 5000);

      // 72o vs AA should be ~12% for 72o
      expect(equity).toBeGreaterThan(0.08);
      expect(equity).toBeLessThan(0.16);
    });

    it('maintains symmetry: equity(A, B) + equity(B, A) = 1.0', () => {
      const ak: Hand = ['Ah', 'Kh'];
      const qq: Hand = ['Qc', 'Qd'];

      const equityAK = calculatePreflopEquityMonteCarlo(ak, qq, 3000);
      const equityQQ = calculatePreflopEquityMonteCarlo(qq, ak, 3000);

      // Due to Monte Carlo variance, allow 5% tolerance
      expect(Math.abs(equityAK + equityQQ - 1.0)).toBeLessThan(0.05);
    });

    it('throws when hands share cards', () => {
      const hand1: Hand = ['Ah', 'Kh'];
      const hand2: Hand = ['Ah', 'Qd']; // Shares Ah

      expect(() => calculatePreflopEquityMonteCarlo(hand1, hand2, 100)).toThrow(
        'Hands share cards'
      );
    });

    it('handles pair vs overcards matchup (coinflip)', () => {
      const jj: Hand = ['Jh', 'Jd'];
      const ak: Hand = ['As', 'Kc'];

      const equity = calculatePreflopEquityMonteCarlo(jj, ak, 5000);

      // JJ vs AK should be ~55% for JJ (slight favorite)
      expect(equity).toBeGreaterThan(0.50);
      expect(equity).toBeLessThan(0.60);
    });
  });

  describe('calculateCanonicalEquity', () => {
    it('calculates equity for canonical hands with card removal', () => {
      const aks: CanonicalHand = 'AKs';
      const qq: CanonicalHand = 'QQ';

      // Use fewer iterations for test speed
      const equity = calculateCanonicalEquity(aks, qq, 500);

      // AKs vs QQ should be ~46% for AKs (slight dog)
      expect(equity).toBeGreaterThan(0.40);
      expect(equity).toBeLessThan(0.52);
    });

    it('returns 0.5 for same canonical hand', () => {
      const aa: CanonicalHand = 'AA';
      const equity = calculateCanonicalEquity(aa, aa, 100);
      expect(equity).toBe(0.5);
    });

    it('handles suited vs offsuit versions', () => {
      const aks: CanonicalHand = 'AKs';
      const ako: CanonicalHand = 'AKo';

      const equity = calculateCanonicalEquity(aks, ako, 500);

      // Slight edge to suited
      expect(equity).toBeGreaterThan(0.48);
      expect(equity).toBeLessThan(0.56);
    });
  });

  describe('getEquityIndex', () => {
    it('returns correct index for AA vs KK', () => {
      const { index, swapped } = getEquityIndex('AA', 'KK');

      // AA is index 0, KK is index 1
      // Index = 0 * 169 + 1 = 1
      expect(index).toBe(1);
      expect(swapped).toBe(false);
    });

    it('returns swapped=true when second hand comes first alphabetically', () => {
      const { index, swapped } = getEquityIndex('KK', 'AA');

      // Should be stored as AA vs KK (lower index first)
      expect(index).toBe(1);
      expect(swapped).toBe(true);
    });

    it('handles diagonal (same hand)', () => {
      const { index, swapped } = getEquityIndex('AA', 'AA');

      expect(index).toBe(0);
      expect(swapped).toBe(false);
    });

    it('throws for invalid canonical hands', () => {
      expect(() => getEquityIndex('XY', 'AA')).toThrow('Invalid canonical hand');
      expect(() => getEquityIndex('AA', 'ZZ')).toThrow('Invalid canonical hand');
    });
  });

  describe('Equity Table', () => {
    it('starts with no table loaded', () => {
      expect(isEquityTableLoaded()).toBe(false);
    });

    it('can set and use equity table', () => {
      // Create a simple test table
      const table = new Float64Array(NUM_CANONICAL_HANDS * NUM_CANONICAL_HANDS);
      table.fill(0.5);

      // Set specific value for AA vs KK
      const { index } = getEquityIndex('AA', 'KK');
      table[index] = 0.82;

      setPreflopEquityTable(table);

      expect(isEquityTableLoaded()).toBe(true);
      expect(calculatePreflopEquityFromTable('AA', 'KK')).toBe(0.82);
    });

    it('handles symmetry in table lookup', () => {
      const table = new Float64Array(NUM_CANONICAL_HANDS * NUM_CANONICAL_HANDS);
      table.fill(0.5);

      const { index } = getEquityIndex('AA', 'KK');
      table[index] = 0.82;

      setPreflopEquityTable(table);

      // AA vs KK = 0.82
      expect(calculatePreflopEquityFromTable('AA', 'KK')).toBe(0.82);

      // KK vs AA = 1 - 0.82 = 0.18 (symmetric)
      expect(calculatePreflopEquityFromTable('KK', 'AA')).toBeCloseTo(0.18, 5);
    });

    it('returns 0.5 for same hand lookup', () => {
      const table = new Float64Array(NUM_CANONICAL_HANDS * NUM_CANONICAL_HANDS);
      table.fill(0.5);
      setPreflopEquityTable(table);

      expect(calculatePreflopEquityFromTable('AA', 'AA')).toBe(0.5);
    });

    it('throws when table not loaded', () => {
      clearEquityTable();
      expect(() => calculatePreflopEquityFromTable('AA', 'KK')).toThrow(
        'Preflop equity table not loaded'
      );
    });

    it('rejects invalid table size', () => {
      const badTable = new Float64Array(100); // Wrong size
      expect(() => setPreflopEquityTable(badTable)).toThrow('Invalid equity table size');
    });
  });

  describe('Edge Cases', () => {
    it('handles all 169 canonical hands', () => {
      expect(CANONICAL_HANDS.length).toBe(169);

      // Verify we can get indices for all hands
      for (const hand of CANONICAL_HANDS) {
        const { index, swapped } = getEquityIndex(hand, 'AA');
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(NUM_CANONICAL_HANDS * NUM_CANONICAL_HANDS);
        expect(typeof swapped).toBe('boolean');
      }
    });

    it('calculates equity for dominated hand (AK vs AA)', () => {
      const aa: Hand = ['Ah', 'As'];
      const ak: Hand = ['Ac', 'Kd']; // AK is dominated by AA

      // AK vs AA should be about 7% for AK (heavily dominated)
      const equity = calculatePreflopEquityMonteCarlo(ak, aa, 5000);
      expect(equity).toBeGreaterThan(0.04);
      expect(equity).toBeLessThan(0.12);
    });

    it('produces consistent results with enough iterations', () => {
      const hand1: Hand = ['Ah', 'Kh'];
      const hand2: Hand = ['Qc', 'Qd'];

      // Run twice with many iterations
      const equity1 = calculatePreflopEquityMonteCarlo(hand1, hand2, 10000);
      const equity2 = calculatePreflopEquityMonteCarlo(hand1, hand2, 10000);

      // Should be within 3% of each other with 10k iterations
      expect(Math.abs(equity1 - equity2)).toBeLessThan(0.03);
    });
  });
});
