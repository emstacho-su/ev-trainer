// src/lib/range/rangeHelpers.test.ts
import { describe, it, expect } from 'vitest';
import {
  normalizeHandString,
  categorizeHandStrength,
  normalizeActionFrequencies,
} from './rangeHelpers';

describe('normalizeHandString', () => {
  it('normalizes pairs to uppercase without suffix', () => {
    expect(normalizeHandString('AA')).toBe('AA');
    expect(normalizeHandString('aa')).toBe('AA');
    expect(normalizeHandString('kk')).toBe('KK');
  });

  it('puts higher rank first for suited hands', () => {
    expect(normalizeHandString('KAs')).toBe('AKs');
    expect(normalizeHandString('9Ts')).toBe('T9s');
    expect(normalizeHandString('AKs')).toBe('AKs');
  });

  it('puts higher rank first for offsuit hands', () => {
    expect(normalizeHandString('KAo')).toBe('AKo');
    expect(normalizeHandString('AKo')).toBe('AKo');
  });

  it('defaults to offsuit for non-pair without suffix', () => {
    expect(normalizeHandString('AK')).toBe('AKo');
    expect(normalizeHandString('KA')).toBe('AKo');
  });

  it('handles edge cases', () => {
    expect(normalizeHandString('22')).toBe('22');
    expect(normalizeHandString('A2s')).toBe('A2s');
    expect(normalizeHandString('2As')).toBe('A2s');
  });

  it('returns input for invalid hands', () => {
    expect(normalizeHandString('X')).toBe('X');
    expect(normalizeHandString('ABCD')).toBe('ABCD');
  });
});

describe('categorizeHandStrength', () => {
  it('classifies premium pairs', () => {
    expect(categorizeHandStrength('AA')).toBe('premium-pairs');
    expect(categorizeHandStrength('KK')).toBe('premium-pairs');
    expect(categorizeHandStrength('QQ')).toBe('premium-pairs');
    expect(categorizeHandStrength('JJ')).toBe('premium-pairs');
  });

  it('classifies medium pairs', () => {
    expect(categorizeHandStrength('TT')).toBe('medium-pairs');
    expect(categorizeHandStrength('99')).toBe('medium-pairs');
    expect(categorizeHandStrength('88')).toBe('medium-pairs');
  });

  it('classifies small pairs', () => {
    expect(categorizeHandStrength('77')).toBe('small-pairs');
    expect(categorizeHandStrength('22')).toBe('small-pairs');
  });

  it('classifies broadway hands', () => {
    expect(categorizeHandStrength('AKs')).toBe('broadway');
    expect(categorizeHandStrength('KQo')).toBe('broadway');
    expect(categorizeHandStrength('ATs')).toBe('broadway');
  });

  it('classifies suited connectors', () => {
    expect(categorizeHandStrength('98s')).toBe('suited-connectors');
    expect(categorizeHandStrength('76s')).toBe('suited-connectors');
    expect(categorizeHandStrength('54s')).toBe('suited-connectors');
  });

  it('classifies suited gappers', () => {
    expect(categorizeHandStrength('97s')).toBe('suited-gappers');
    expect(categorizeHandStrength('A5s')).toBe('suited-gappers');
  });

  it('classifies offsuit hands', () => {
    expect(categorizeHandStrength('72o')).toBe('offsuit');
    expect(categorizeHandStrength('93o')).toBe('offsuit');
  });
});

describe('normalizeActionFrequencies', () => {
  it('returns empty array for all-zero frequencies', () => {
    expect(normalizeActionFrequencies([
      { type: 'fold', frequency: 0 },
      { type: 'call', frequency: 0 },
    ])).toEqual([]);
  });

  it('passes through frequencies that already sum to 1.0', () => {
    const actions = [
      { type: 'fold' as const, frequency: 0.3 },
      { type: 'call' as const, frequency: 0.7 },
    ];
    const result = normalizeActionFrequencies(actions);
    expect(result).toHaveLength(2);
    expect(result[0].frequency + result[1].frequency).toBeCloseTo(1.0);
  });

  it('scales frequencies to sum to 1.0', () => {
    const actions = [
      { type: 'fold' as const, frequency: 2 },
      { type: 'call' as const, frequency: 3 },
    ];
    const result = normalizeActionFrequencies(actions);
    expect(result).toHaveLength(2);
    expect(result[0].frequency).toBeCloseTo(0.4);
    expect(result[1].frequency).toBeCloseTo(0.6);
  });

  it('filters out zero-frequency actions', () => {
    const actions = [
      { type: 'fold' as const, frequency: 0 },
      { type: 'call' as const, frequency: 0.5 },
      { type: 'raise' as const, frequency: 0.5 },
    ];
    const result = normalizeActionFrequencies(actions);
    expect(result).toHaveLength(2);
    expect(result.every(a => a.frequency > 0)).toBe(true);
  });
});
