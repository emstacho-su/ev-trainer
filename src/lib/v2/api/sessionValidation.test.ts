// src/lib/v2/api/sessionValidation.test.ts
import { describe, it, expect } from 'vitest';
import {
  isObject,
  requireString,
  requireNumber,
  parseMode,
  parseFilters,
  stableStringify,
  deriveSessionId,
  deriveSelectionSessionId,
  DEFAULT_PACK_ID,
  SESSION_ID_HASH_LENGTH,
} from './sessionValidation';

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject('string')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(true)).toBe(false);
  });

  it('returns true for arrays (they are objects)', () => {
    expect(isObject([])).toBe(true);
  });
});

describe('requireString', () => {
  it('returns string value when present', () => {
    expect(requireString({ name: 'test' }, 'name')).toBe('test');
  });

  it('returns null for missing key', () => {
    expect(requireString({}, 'name')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(requireString({ name: '' }, 'name')).toBeNull();
    expect(requireString({ name: '  ' }, 'name')).toBeNull();
  });

  it('returns null for non-string value', () => {
    expect(requireString({ name: 42 }, 'name')).toBeNull();
    expect(requireString({ name: null }, 'name')).toBeNull();
  });
});

describe('requireNumber', () => {
  it('returns number value when present', () => {
    expect(requireNumber({ count: 5 }, 'count')).toBe(5);
    expect(requireNumber({ val: 0 }, 'val')).toBe(0);
  });

  it('returns null for missing key', () => {
    expect(requireNumber({}, 'count')).toBeNull();
  });

  it('returns null for non-number value', () => {
    expect(requireNumber({ count: 'five' }, 'count')).toBeNull();
  });

  it('returns null for NaN and Infinity', () => {
    expect(requireNumber({ count: NaN }, 'count')).toBeNull();
    expect(requireNumber({ count: Infinity }, 'count')).toBeNull();
  });
});

describe('parseMode', () => {
  it('accepts TRAINING mode', () => {
    expect(parseMode('TRAINING')).toBe('TRAINING');
  });

  it('accepts PRACTICE mode', () => {
    expect(parseMode('PRACTICE')).toBe('PRACTICE');
  });

  it('rejects invalid modes', () => {
    expect(parseMode('INVALID')).toBeNull();
    expect(parseMode(42)).toBeNull();
    expect(parseMode(null)).toBeNull();
    expect(parseMode('')).toBeNull();
  });
});

describe('parseFilters', () => {
  it('returns empty object for undefined', () => {
    expect(parseFilters(undefined)).toEqual({});
  });

  it('returns null for non-object', () => {
    expect(parseFilters('string')).toBeNull();
    expect(parseFilters(42)).toBeNull();
  });

  it('parses valid street filter', () => {
    const result = parseFilters({ street: 'PREFLOP' });
    expect(result).not.toBeNull();
    expect(result!.street).toBe('PREFLOP');
  });

  it('rejects invalid street', () => {
    expect(parseFilters({ street: 'INVALID_STREET' })).toBeNull();
    expect(parseFilters({ street: 42 })).toBeNull();
  });

  it('parses valid heroPosition', () => {
    const result = parseFilters({ heroPosition: 'BTN' });
    expect(result).not.toBeNull();
    expect(result!.heroPosition).toBe('BTN');
  });

  it('rejects invalid position', () => {
    expect(parseFilters({ heroPosition: 'MIDDLE' })).toBeNull();
  });

  it('parses valid potType', () => {
    const result = parseFilters({ potType: 'SRP' });
    expect(result).not.toBeNull();
    expect(result!.potType).toBe('SRP');
  });

  it('accepts ANY potType', () => {
    const result = parseFilters({ potType: 'ANY' });
    expect(result).not.toBeNull();
  });

  it('parses positions array', () => {
    const result = parseFilters({ positions: ['BTN', 'CO', 'HJ'] });
    expect(result).not.toBeNull();
    expect(result!.heroPositions).toEqual(['BTN', 'CO', 'HJ']);
  });

  it('rejects invalid positions array', () => {
    expect(parseFilters({ positions: 'BTN' })).toBeNull();
    expect(parseFilters({ positions: ['INVALID'] })).toBeNull();
  });

  it('parses empty object as valid', () => {
    expect(parseFilters({})).toEqual({});
  });
});

describe('stableStringify', () => {
  it('handles primitives', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe('undefined');
    expect(stableStringify('hello')).toBe('"hello"');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify(true)).toBe('true');
  });

  it('handles arrays', () => {
    expect(stableStringify([1, 2, 3])).toBe('[1,2,3]');
  });

  it('sorts object keys for stability', () => {
    const a = stableStringify({ b: 2, a: 1 });
    const b = stableStringify({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('handles nested objects', () => {
    const result = stableStringify({ z: { b: 2, a: 1 }, a: [3, 1] });
    expect(result).toContain('"a"');
    expect(result).toContain('"z"');
  });
});

describe('deriveSessionId', () => {
  it('produces deterministic IDs', () => {
    const input = { seed: 'test-seed', mode: 'TRAINING' as const };
    const filters = {};
    const id1 = deriveSessionId(input, filters);
    const id2 = deriveSessionId(input, filters);
    expect(id1).toBe(id2);
  });

  it('starts with sess_ prefix', () => {
    const id = deriveSessionId({ seed: 's', mode: 'TRAINING' }, {});
    expect(id.startsWith('sess_')).toBe(true);
  });

  it('has correct length', () => {
    const id = deriveSessionId({ seed: 's', mode: 'TRAINING' }, {});
    expect(id.length).toBe(5 + SESSION_ID_HASH_LENGTH); // "sess_" + hash
  });

  it('different inputs produce different IDs', () => {
    const id1 = deriveSessionId({ seed: 'a', mode: 'TRAINING' }, {});
    const id2 = deriveSessionId({ seed: 'b', mode: 'TRAINING' }, {});
    expect(id1).not.toBe(id2);
  });

  it('uses DEFAULT_PACK_ID when not specified', () => {
    const id1 = deriveSessionId({ seed: 's', mode: 'TRAINING' }, {});
    const id2 = deriveSessionId({ seed: 's', mode: 'TRAINING', packId: DEFAULT_PACK_ID }, {});
    expect(id1).toBe(id2);
  });
});

describe('deriveSelectionSessionId', () => {
  it('starts with sel_ prefix', () => {
    const id = deriveSelectionSessionId({
      seed: 'test',
      packId: 'pack-1',
      filters: {},
    });
    expect(id.startsWith('sel_')).toBe(true);
  });

  it('is deterministic', () => {
    const input = { seed: 'test', packId: 'pack-1', filters: {} };
    expect(deriveSelectionSessionId(input)).toBe(deriveSelectionSessionId(input));
  });
});
