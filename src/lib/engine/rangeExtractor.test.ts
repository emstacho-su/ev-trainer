// src/lib/engine/rangeExtractor.test.ts
import { describe, it, expect } from 'vitest';
import { extractRangeData, extractActionSummary } from './rangeExtractor';
import type { SolverNodeOutput } from './solverAdapter';

function makeOutput(overrides?: Partial<SolverNodeOutput>): SolverNodeOutput {
  return {
    status: 'ok',
    units: 'bb',
    actions: [
      { actionId: 'FOLD', frequency: 0.3, ev: -0.5 },
      { actionId: 'CALL', frequency: 0.4, ev: 0.8 },
      { actionId: 'RAISE_3', frequency: 0.3, ev: 1.5 },
    ],
    ...overrides,
  };
}

describe('extractRangeData', () => {
  it('returns empty range for non-ok status', () => {
    const output = makeOutput({ status: 'unsolved', actions: [] });
    const range = extractRangeData(output);
    expect(range.hands).toEqual([]);
    expect(range.totalCombos).toBe(0);
  });

  it('returns empty range for ok with no actions', () => {
    const output = makeOutput({ actions: [] });
    const range = extractRangeData(output);
    expect(range.hands).toEqual([]);
  });

  it('produces 169 hands for a standard output', () => {
    const output = makeOutput();
    const range = extractRangeData(output);
    expect(range.totalCombos).toBe(169);
    expect(range.hands.length).toBe(169);
  });

  it('each hand has normalized action frequencies summing to ~1.0', () => {
    const output = makeOutput();
    const range = extractRangeData(output);

    for (const hand of range.hands) {
      const sum = hand.actions.reduce((s, a) => s + a.frequency, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it('is deterministic with same seed', () => {
    const output = makeOutput();
    const range1 = extractRangeData(output, 'hero');
    const range2 = extractRangeData(output, 'hero');

    expect(range1.hands.length).toBe(range2.hands.length);
    for (let i = 0; i < range1.hands.length; i++) {
      expect(range1.hands[i].hand).toBe(range2.hands[i].hand);
      expect(range1.hands[i].actions.length).toBe(range2.hands[i].actions.length);
    }
  });

  it('produces different distributions with different seeds', () => {
    const output = makeOutput();
    const hero = extractRangeData(output, 'hero');
    const villain = extractRangeData(output, 'villain');

    // At least some hands should have different frequencies
    let differences = 0;
    for (let i = 0; i < hero.hands.length; i++) {
      const h = hero.hands[i].actions[0]?.frequency ?? 0;
      const v = villain.hands[i].actions[0]?.frequency ?? 0;
      if (Math.abs(h - v) > 0.01) differences++;
    }
    expect(differences).toBeGreaterThan(0);
  });

  it('merges BET and RAISE actions into raise type', () => {
    const output = makeOutput({
      actions: [
        { actionId: 'CHECK', frequency: 0.4, ev: 0 },
        { actionId: 'BET_33', frequency: 0.3, ev: 1.0 },
        { actionId: 'BET_75', frequency: 0.2, ev: 0.8 },
        { actionId: 'ALL_IN', frequency: 0.1, ev: 2.0 },
      ],
    });
    const range = extractRangeData(output);

    // Each hand should have at most: call (from CHECK), raise (from BET_33 + BET_75), jam (from ALL_IN)
    const firstHand = range.hands[0];
    const actionTypes = firstHand.actions.map(a => a.type);
    expect(actionTypes).not.toContain('fold'); // No FOLD in input
    // raise should be merged from BET_33 + BET_75
    expect(actionTypes).toContain('raise');
  });

  it('premium hands get higher raise frequency', () => {
    const output = makeOutput({
      actions: [
        { actionId: 'FOLD', frequency: 0.5, ev: -1 },
        { actionId: 'RAISE_3', frequency: 0.5, ev: 2 },
      ],
    });
    const range = extractRangeData(output, 'test');

    const aaHand = range.hands.find(h => h.hand === 'AA');
    const sevTwoHand = range.hands.find(h => h.hand === '72o');

    const aaRaise = aaHand?.actions.find(a => a.type === 'raise')?.frequency ?? 0;
    const sevTwoRaise = sevTwoHand?.actions.find(a => a.type === 'raise')?.frequency ?? 0;

    // AA should have higher raise frequency than 72o
    expect(aaRaise).toBeGreaterThan(sevTwoRaise);
  });
});

describe('extractActionSummary', () => {
  it('returns empty for non-ok status', () => {
    const output = makeOutput({ status: 'error', actions: [] });
    expect(extractActionSummary(output)).toEqual([]);
  });

  it('formats action labels correctly', () => {
    const output = makeOutput({
      actions: [
        { actionId: 'FOLD', frequency: 0.3, ev: -0.5 },
        { actionId: 'CALL', frequency: 0.4, ev: 0.8 },
        { actionId: 'BET_33', frequency: 0.2, ev: 1.0 },
        { actionId: 'ALL_IN', frequency: 0.1, ev: 2.0 },
      ],
    });

    const summary = extractActionSummary(output);
    expect(summary).toHaveLength(4);
    expect(summary[0].label).toBe('Fold');
    expect(summary[1].label).toBe('Call');
    expect(summary[2].label).toBe('Bet 33%');
    expect(summary[3].label).toBe('All-in');
  });

  it('preserves original frequencies', () => {
    const output = makeOutput();
    const summary = extractActionSummary(output);
    expect(summary[0].frequency).toBe(0.3);
    expect(summary[1].frequency).toBe(0.4);
  });
});
