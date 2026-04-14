// src/__tests__/supabase/spotService.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  convertSupabaseSpotToEngineSpot,
  extractSpotMeta,
  generateTags,
  convertEngineSpotToSupabaseRow,
  getFilteredSpots,
  getSpotById,
  getRandomSpots,
  createSpot,
} from '@/lib/supabase/spotService';

// Minimal Supabase spot row for testing
function makeSpotRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'uuid-1',
    spot_id: 'spot-btn-vs-bb-srp-100bb',
    is_system: true,
    created_by: null,
    street: 'PREFLOP',
    hero_position: 'BTN',
    villain_position: 'BB',
    board: [],
    hero_to_act: 'BTN',
    positions: ['BTN', 'SB', 'BB'],
    stacks_bb: { BTN: 100, SB: 99.5, BB: 99 },
    pot_bb: 2.5,
    history: ['SB:0.5', 'BB:1'],
    hero_hand: null,
    pot_type: 'SRP',
    effective_stack_bb: 99,
    scenario_type: 'open-raise',
    difficulty_rating: null,
    tags: ['preflop', 'hero:BTN', 'villain:BB'],
    share_code: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  } as any;
}

function makeEngineSpot() {
  return {
    schemaVersion: '1' as const,
    spotId: 'spot-btn-vs-bb-srp-100bb',
    gameType: 'NLHE' as const,
    blinds: { sb: 0.5, bb: 1, ante: 0 },
    positions: ['BTN', 'SB', 'BB'] as any,
    stacksBb: { BTN: 100, SB: 99.5, BB: 99 } as any,
    potBb: 2.5,
    board: [],
    history: ['SB:0.5', 'BB:1'],
    heroToAct: 'BTN' as const,
  };
}

function makeSpotMeta() {
  return {
    street: 'PREFLOP' as const,
    heroPosition: 'BTN' as const,
    villainPosition: 'BB' as const,
    effectiveStackBb: 99,
    potType: 'SRP' as const,
    scenarioType: 'open-raise' as any,
  };
}

/**
 * Thenable mock Supabase client.
 */
function createMockSupabase(tableResponses: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => {
      const resp = tableResponses[table] ?? { data: null, error: null };
      const chain: any = {};
      const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gte', 'lte', 'order', 'range', 'limit', 'overlaps'];
      for (const m of methods) {
        chain[m] = vi.fn(() => chain);
      }
      chain.maybeSingle = vi.fn(() => Promise.resolve(resp));
      chain.single = vi.fn(() => Promise.resolve(resp));
      chain.then = (resolve: Function, reject?: Function) => Promise.resolve(resp).then(resolve, reject);
      return chain;
    }),
  } as any;
}

describe('spotService', () => {
  describe('convertSupabaseSpotToEngineSpot', () => {
    it('converts a Supabase row to engine Spot', () => {
      const row = makeSpotRow();
      const spot = convertSupabaseSpotToEngineSpot(row);

      expect(spot.spotId).toBe('spot-btn-vs-bb-srp-100bb');
      expect(spot.schemaVersion).toBe('1');
      expect(spot.gameType).toBe('NLHE');
      expect(spot.potBb).toBe(2.5);
      expect(spot.heroToAct).toBe('BTN');
      expect(spot.positions).toEqual(['BTN', 'SB', 'BB']);
      expect(spot.board).toEqual([]);
    });

    it('preserves blind structure', () => {
      const spot = convertSupabaseSpotToEngineSpot(makeSpotRow());
      expect(spot.blinds).toEqual({ sb: 0.5, bb: 1, ante: 0 });
    });
  });

  describe('extractSpotMeta', () => {
    it('extracts meta from a Supabase row', () => {
      const row = makeSpotRow();
      const meta = extractSpotMeta(row);

      expect(meta.street).toBe('PREFLOP');
      expect(meta.heroPosition).toBe('BTN');
      expect(meta.villainPosition).toBe('BB');
      expect(meta.effectiveStackBb).toBe(99);
      expect(meta.potType).toBe('SRP');
      expect(meta.scenarioType).toBe('open-raise');
    });

    it('falls back to heroPosition when villainPosition is null', () => {
      const row = makeSpotRow({ villain_position: null });
      const meta = extractSpotMeta(row);
      expect(meta.villainPosition).toBe('BTN');
    });
  });

  describe('generateTags', () => {
    it('generates basic tags for a preflop spot', () => {
      const spot = makeEngineSpot();
      const meta = makeSpotMeta();
      const tags = generateTags(spot, meta);

      expect(tags).toContain('preflop');
      expect(tags).toContain('hero:BTN');
      expect(tags).toContain('villain:BB');
      expect(tags).toContain('srp');
      expect(tags).toContain('scenario:open-raise');
    });

    it('adds deep-stack tag for 99bb', () => {
      const tags = generateTags(makeEngineSpot(), makeSpotMeta());
      expect(tags).toContain('deep-stack');
    });

    it('adds short-stack tag for 20bb', () => {
      const meta = { ...makeSpotMeta(), effectiveStackBb: 20 };
      const tags = generateTags(makeEngineSpot(), meta);
      expect(tags).toContain('short-stack');
    });

    it('adds mid-stack tag for 40bb', () => {
      const meta = { ...makeSpotMeta(), effectiveStackBb: 40 };
      const tags = generateTags(makeEngineSpot(), meta);
      expect(tags).toContain('mid-stack');
    });

    it('adds ultra-deep tag for 150bb', () => {
      const meta = { ...makeSpotMeta(), effectiveStackBb: 150 };
      const tags = generateTags(makeEngineSpot(), meta);
      expect(tags).toContain('ultra-deep');
    });

    it('adds postflop-specific tags for flop spot', () => {
      const spot = { ...makeEngineSpot(), board: ['Ah', 'Kh', '7h'] };
      const meta = { ...makeSpotMeta(), street: 'FLOP' as const };
      const tags = generateTags(spot, meta);

      expect(tags).toContain('postflop');
      expect(tags).toContain('flush-draw');
    });

    it('adds paired-board tag when board has pair', () => {
      const spot = { ...makeEngineSpot(), board: ['Ah', 'Ad', '7c'] };
      const meta = { ...makeSpotMeta(), street: 'FLOP' as const };
      const tags = generateTags(spot, meta);

      expect(tags).toContain('paired-board');
    });
  });

  describe('convertEngineSpotToSupabaseRow', () => {
    it('converts engine Spot + Meta to Supabase insert row', () => {
      const spot = makeEngineSpot();
      const meta = makeSpotMeta();
      const row = convertEngineSpotToSupabaseRow(spot, meta, { is_system: true });

      expect(row.spot_id).toBe('spot-btn-vs-bb-srp-100bb');
      expect(row.street).toBe('PREFLOP');
      expect(row.is_system).toBe(true);
      expect(row.tags).toBeInstanceOf(Array);
      expect(row.tags!.length).toBeGreaterThan(0);
    });

    it('defaults is_system to false', () => {
      const row = convertEngineSpotToSupabaseRow(makeEngineSpot(), makeSpotMeta());
      expect(row.is_system).toBe(false);
    });
  });

  describe('getFilteredSpots', () => {
    it('returns spots from Supabase', async () => {
      const supabase = createMockSupabase({
        spots: { data: [makeSpotRow()], error: null },
      });

      const result = await getFilteredSpots(supabase);
      expect(result).toHaveLength(1);
      expect(result[0].spot_id).toBe('spot-btn-vs-bb-srp-100bb');
    });

    it('throws on error', async () => {
      const supabase = createMockSupabase({
        spots: { data: null, error: { message: 'RLS' } },
      });

      await expect(getFilteredSpots(supabase)).rejects.toThrow(/Failed to fetch/);
    });
  });

  describe('getSpotById', () => {
    it('returns a single spot', async () => {
      const supabase = createMockSupabase({
        spots: { data: makeSpotRow(), error: null },
      });

      const result = await getSpotById(supabase, 'spot-1');
      expect(result).not.toBeNull();
    });

    it('returns null when not found', async () => {
      const supabase = createMockSupabase({
        spots: { data: null, error: null },
      });

      const result = await getSpotById(supabase, 'missing');
      expect(result).toBeNull();
    });
  });

  describe('getRandomSpots', () => {
    it('returns shuffled spots', async () => {
      const ids = [
        { spot_id: 's1' }, { spot_id: 's2' }, { spot_id: 's3' },
      ];
      const fullRows = [makeSpotRow({ spot_id: 's1' }), makeSpotRow({ spot_id: 's2' })];

      let callCount = 0;
      const supabase = {
        from: vi.fn(() => {
          callCount++;
          const chain: any = {};
          const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gte', 'lte', 'order', 'range', 'limit', 'overlaps'];
          for (const m of methods) {
            chain[m] = vi.fn(() => chain);
          }
          // First call: id-only query, second call: full row fetch
          const resp = callCount <= 1
            ? { data: ids, error: null }
            : { data: fullRows, error: null };
          chain.maybeSingle = vi.fn(() => Promise.resolve(resp));
          chain.single = vi.fn(() => Promise.resolve(resp));
          chain.then = (resolve: Function) => Promise.resolve(resp).then(resolve);
          return chain;
        }),
      } as any;

      const result = await getRandomSpots(supabase, {}, 2, 'test-seed');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('createSpot', () => {
    it('inserts and returns the new spot', async () => {
      const newRow = makeSpotRow({ spot_id: 'new-spot' });
      const supabase = createMockSupabase({
        spots: { data: newRow, error: null },
      });

      const result = await createSpot(supabase, {} as any);
      expect(result.spot_id).toBe('new-spot');
    });
  });
});
