// src/__tests__/supabase/solverCache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildCacheKey,
  getCachedResult,
  cacheResult,
} from '@/lib/engine/solverCache';

// Mock Dexie (IndexedDB)
vi.mock('dexie', () => {
  const mockTable = {
    get: vi.fn(),
    put: vi.fn(),
  };
  class MockDexie {
    solverCache = mockTable;
    version() { return { stores: () => {} }; }
  }
  return { default: MockDexie, Dexie: MockDexie };
});

describe('solverCache', () => {
  describe('buildCacheKey', () => {
    it('produces deterministic hash for same input', () => {
      const request = {
        gameVersion: '1.0',
        abstractionVersion: '1.0',
        solverVersion: '1.0',
        publicState: {
          street: 'PREFLOP' as const,
          potBb: 3,
          effectiveStackBb: 97,
          board: [],
          toAct: 'BTN' as const,
        },
        history: { actions: [] },
        toAct: 'BTN' as const,
      };

      const key1 = buildCacheKey(request);
      const key2 = buildCacheKey(request);
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBeGreaterThan(0);
    });

    it('produces different keys for different states', () => {
      const base = {
        gameVersion: '1.0',
        abstractionVersion: '1.0',
        solverVersion: '1.0',
        publicState: {
          street: 'PREFLOP' as const,
          potBb: 3,
          effectiveStackBb: 97,
          board: [],
          toAct: 'BTN' as const,
        },
        history: { actions: [] },
        toAct: 'BTN' as const,
      };

      const variant = {
        ...base,
        publicState: { ...base.publicState, potBb: 6 },
      };

      expect(buildCacheKey(base)).not.toBe(buildCacheKey(variant));
    });

    it('produces different keys for different board cards', () => {
      const base = {
        gameVersion: '1.0',
        abstractionVersion: '1.0',
        solverVersion: '1.0',
        publicState: {
          street: 'FLOP' as const,
          potBb: 6,
          effectiveStackBb: 94,
          board: ['Ah', 'Kd', '7c'],
          toAct: 'BTN' as const,
        },
        history: { actions: [] },
        toAct: 'BTN' as const,
      };

      const variant = {
        ...base,
        publicState: { ...base.publicState, board: ['Ah', 'Kd', '2s'] },
      };

      expect(buildCacheKey(base)).not.toBe(buildCacheKey(variant));
    });
  });
});
