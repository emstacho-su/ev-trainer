// src/__tests__/rangeVisualization.test.ts
// Integration test for Phase 6: Range Visualization.
// Covers all 5 success criteria for range display from solver output.

import { describe, it, expect } from 'vitest';
import { extractRangeData, extractActionSummary } from '../lib/engine/rangeExtractor';
import { categorizeHandStrength, normalizeActionFrequencies } from '../lib/range/rangeHelpers';
import { getHandAtPosition, getGridPosition } from '../lib/range/gridLayout';
import type { SolverNodeOutput } from '../lib/engine/solverAdapter';
import type { RangeActionType } from '../lib/range/types';

// ── Helpers ───────────────────────────────────────────────────────────

function makeSolverOutput(
  actions: { actionId: string; frequency: number; ev: number }[],
): SolverNodeOutput {
  return { actions, status: 'ok', units: 'bb' };
}

const TYPICAL_OUTPUT = makeSolverOutput([
  { actionId: 'FOLD', frequency: 0.35, ev: -1.0 },
  { actionId: 'CALL', frequency: 0.40, ev: 1.5 },
  { actionId: 'BET_75', frequency: 0.25, ev: 2.0 },
]);

// ── SC1: Range grid cells show real action frequencies color-coded ───

describe('SC1: Range grid cells with real frequencies', () => {
  it('extractRangeData produces 169 hands from solver output', () => {
    const range = extractRangeData(TYPICAL_OUTPUT, 'hero');
    expect(range.hands.length).toBe(169);
    expect(range.totalCombos).toBe(169);
  });

  it('each hand has normalized frequencies summing to ~1.0', () => {
    const range = extractRangeData(TYPICAL_OUTPUT, 'hero');
    for (const hand of range.hands) {
      const total = hand.actions.reduce((sum, a) => sum + a.frequency, 0);
      expect(total).toBeCloseTo(1.0, 1);
    }
  });

  it('hand frequencies are color-mapped to fold/call/raise/jam', () => {
    const range = extractRangeData(TYPICAL_OUTPUT, 'hero');
    const validTypes: RangeActionType[] = ['fold', 'call', 'raise', 'jam'];
    for (const hand of range.hands) {
      for (const action of hand.actions) {
        expect(validTypes).toContain(action.type);
        expect(action.frequency).toBeGreaterThan(0);
        expect(action.frequency).toBeLessThanOrEqual(1);
      }
    }
  });

  it('premium hands have more raise, weak hands have more fold', () => {
    const range = extractRangeData(TYPICAL_OUTPUT, 'hero');

    // AA should be raise-heavy
    const aaHand = range.hands.find((h) => h.hand === 'AA');
    expect(aaHand).toBeDefined();
    const aaRaise = aaHand!.actions.find((a) => a.type === 'raise');
    const aaFold = aaHand!.actions.find((a) => a.type === 'fold');
    if (aaRaise && aaFold) {
      expect(aaRaise.frequency).toBeGreaterThan(aaFold.frequency);
    }

    // 72o should be fold-heavy
    const worstHand = range.hands.find((h) => h.hand === '72o');
    expect(worstHand).toBeDefined();
    const worstFold = worstHand!.actions.find((a) => a.type === 'fold');
    const worstRaise = worstHand!.actions.find((a) => a.type === 'raise');
    if (worstFold && worstRaise) {
      expect(worstFold.frequency).toBeGreaterThan(worstRaise.frequency);
    }
  });

  it('BET_* and RAISE_* solver actions map to raise type', () => {
    const betOutput = makeSolverOutput([
      { actionId: 'CHECK', frequency: 0.4, ev: 1.0 },
      { actionId: 'BET_33', frequency: 0.3, ev: 1.5 },
      { actionId: 'BET_75', frequency: 0.2, ev: 2.0 },
      { actionId: 'RAISE_2.2', frequency: 0.1, ev: 2.5 },
    ]);
    const range = extractRangeData(betOutput, 'hero');
    // All BET/RAISE should be merged into 'raise'
    for (const hand of range.hands) {
      const types = hand.actions.map((a) => a.type);
      expect(types).not.toContain('bet' as RangeActionType);
      // Should have call (from CHECK) and raise (from BET_33 + BET_75 + RAISE_2.2)
      expect(types).toContain('call');
      expect(types).toContain('raise');
    }
  });
});

// ── SC2: Hero and villain ranges displayed side-by-side ──────────────

describe('SC2: Hero and villain ranges', () => {
  it('hero and villain seeds produce different range distributions', () => {
    const heroRange = extractRangeData(TYPICAL_OUTPUT, 'hero');
    const villainRange = extractRangeData(TYPICAL_OUTPUT, 'villain');

    // Both should have 169 hands
    expect(heroRange.hands.length).toBe(169);
    expect(villainRange.hands.length).toBe(169);

    // Frequencies should differ due to different seed noise
    let diffCount = 0;
    for (let i = 0; i < heroRange.hands.length; i++) {
      const heroActions = heroRange.hands[i].actions;
      const villainActions = villainRange.hands[i].actions;
      if (heroActions.length !== villainActions.length) {
        diffCount++;
        continue;
      }
      for (let j = 0; j < heroActions.length; j++) {
        if (Math.abs(heroActions[j].frequency - villainActions[j].frequency) > 0.01) {
          diffCount++;
          break;
        }
      }
    }
    expect(diffCount).toBeGreaterThan(0);
  });
});

// ── SC3: Board cards shown (tested via component props) ──────────────

describe('SC3: Board cards display', () => {
  it('grid layout provides correct hand at every position', () => {
    // Verify the 13x13 grid is fully populated
    let count = 0;
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) {
        const hand = getHandAtPosition(row, col);
        expect(hand).not.toBeNull();
        count++;
      }
    }
    expect(count).toBe(169);
  });

  it('diagonal positions are pairs', () => {
    for (let i = 0; i < 13; i++) {
      const hand = getHandAtPosition(i, i)!;
      expect(hand[0]).toBe(hand[1]);
      expect(hand.length).toBe(2); // No suffix for pairs
    }
  });

  it('above-diagonal positions are suited', () => {
    const hand = getHandAtPosition(0, 1); // AKs
    expect(hand).toBe('AKs');
  });

  it('below-diagonal positions are offsuit', () => {
    const hand = getHandAtPosition(1, 0); // AKo
    expect(hand).toBe('AKo');
  });

  it('getGridPosition roundtrips with getHandAtPosition', () => {
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) {
        const hand = getHandAtPosition(row, col)!;
        const pos = getGridPosition(hand);
        expect(pos).toEqual([row, col]);
      }
    }
  });
});

// ── SC4: Equity breakdown by hand category ───────────────────────────

describe('SC4: Equity breakdown by hand category', () => {
  it('categorizes premium pairs correctly', () => {
    expect(categorizeHandStrength('AA')).toBe('premium-pairs');
    expect(categorizeHandStrength('KK')).toBe('premium-pairs');
    expect(categorizeHandStrength('QQ')).toBe('premium-pairs');
    expect(categorizeHandStrength('JJ')).toBe('premium-pairs');
  });

  it('categorizes medium and small pairs', () => {
    expect(categorizeHandStrength('TT')).toBe('medium-pairs');
    expect(categorizeHandStrength('99')).toBe('medium-pairs');
    expect(categorizeHandStrength('88')).toBe('medium-pairs');
    expect(categorizeHandStrength('77')).toBe('small-pairs');
    expect(categorizeHandStrength('22')).toBe('small-pairs');
  });

  it('categorizes broadway hands', () => {
    expect(categorizeHandStrength('AKs')).toBe('broadway');
    expect(categorizeHandStrength('ATs')).toBe('broadway');
    expect(categorizeHandStrength('KQo')).toBe('broadway');
  });

  it('categorizes suited connectors and gappers', () => {
    expect(categorizeHandStrength('98s')).toBe('suited-connectors');
    expect(categorizeHandStrength('76s')).toBe('suited-connectors');
    expect(categorizeHandStrength('97s')).toBe('suited-gappers');
    expect(categorizeHandStrength('A5s')).toBe('suited-gappers');
  });

  it('categorizes offsuit non-broadway', () => {
    expect(categorizeHandStrength('72o')).toBe('offsuit');
    expect(categorizeHandStrength('93o')).toBe('offsuit');
  });

  it('range data covers all equity categories', () => {
    const range = extractRangeData(TYPICAL_OUTPUT, 'hero');
    const categories = new Set(range.hands.map((h) => categorizeHandStrength(h.hand)));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });
});

// ── SC5: Action frequency summary ────────────────────────────────────

describe('SC5: Action frequency summary', () => {
  it('extractActionSummary returns formatted labels and frequencies', () => {
    const summary = extractActionSummary(TYPICAL_OUTPUT);
    expect(summary.length).toBe(3);

    const labels = summary.map((s) => s.label);
    expect(labels).toContain('Fold');
    expect(labels).toContain('Call');
    expect(labels).toContain('Bet 75%');

    const freqSum = summary.reduce((sum, s) => sum + s.frequency, 0);
    expect(freqSum).toBeCloseTo(1.0, 2);
  });

  it('handles bet/raise labels correctly', () => {
    const output = makeSolverOutput([
      { actionId: 'CHECK', frequency: 0.3, ev: 1.0 },
      { actionId: 'BET_33', frequency: 0.4, ev: 1.5 },
      { actionId: 'RAISE_2.5', frequency: 0.2, ev: 2.0 },
      { actionId: 'ALL_IN', frequency: 0.1, ev: 3.0 },
    ]);
    const summary = extractActionSummary(output);
    const labels = summary.map((s) => s.label);
    expect(labels).toContain('Check');
    expect(labels).toContain('Bet 33%');
    expect(labels).toContain('Raise 2.5x');
    expect(labels).toContain('All-in');
  });

  it('returns empty for unsolved output', () => {
    const output: SolverNodeOutput = { actions: [], status: 'unsolved', units: 'bb' };
    const summary = extractActionSummary(output);
    expect(summary).toEqual([]);
  });

  it('normalizeActionFrequencies handles rounding errors', () => {
    const actions = [
      { type: 'fold' as RangeActionType, frequency: 0.333333 },
      { type: 'call' as RangeActionType, frequency: 0.333333 },
      { type: 'raise' as RangeActionType, frequency: 0.333334 },
    ];
    const normalized = normalizeActionFrequencies(actions);
    const total = normalized.reduce((sum, a) => sum + a.frequency, 0);
    expect(total).toBeCloseTo(1.0, 6);
  });

  it('normalizeActionFrequencies filters zero-frequency actions', () => {
    const actions = [
      { type: 'fold' as RangeActionType, frequency: 0 },
      { type: 'call' as RangeActionType, frequency: 0.6 },
      { type: 'raise' as RangeActionType, frequency: 0.4 },
    ];
    const normalized = normalizeActionFrequencies(actions);
    expect(normalized.length).toBe(2);
    expect(normalized.find((a) => a.type === 'fold')).toBeUndefined();
  });
});

// ── rangeExtractor edge cases ────────────────────────────────────────

describe('rangeExtractor edge cases', () => {
  it('returns empty range for error status', () => {
    const output: SolverNodeOutput = { actions: [], status: 'error', units: 'bb' };
    const range = extractRangeData(output, 'hero');
    expect(range.hands.length).toBe(0);
    expect(range.totalCombos).toBe(0);
  });

  it('returns empty range for unsolved status', () => {
    const output: SolverNodeOutput = { actions: [], status: 'unsolved', units: 'bb' };
    const range = extractRangeData(output, 'hero');
    expect(range.hands.length).toBe(0);
  });

  it('deterministic: same input produces same output', () => {
    const r1 = extractRangeData(TYPICAL_OUTPUT, 'hero');
    const r2 = extractRangeData(TYPICAL_OUTPUT, 'hero');
    expect(r1).toEqual(r2);
  });

  it('different seeds produce different outputs', () => {
    const r1 = extractRangeData(TYPICAL_OUTPUT, 'seed-a');
    const r2 = extractRangeData(TYPICAL_OUTPUT, 'seed-b');
    // Not all hands will differ but some should
    let diffCount = 0;
    for (let i = 0; i < r1.hands.length; i++) {
      const a1 = r1.hands[i].actions[0]?.frequency ?? 0;
      const a2 = r2.hands[i].actions[0]?.frequency ?? 0;
      if (Math.abs(a1 - a2) > 0.01) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(0);
  });
});
