// src/lib/v2/packs/loadBundledPack.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadSpotsFromSupabase, loadSpots, clearBundledPackCache } from './loadBundledPack';

// Mock Supabase spotService
vi.mock('@/lib/supabase/spotService', () => ({
  getFilteredSpots: vi.fn(),
  convertSupabaseSpotToEngineSpot: vi.fn((row: any) => ({
    schemaVersion: '1',
    spotId: row.spot_id,
    gameType: 'NLHE',
    blinds: { sb: 0.5, bb: 1, ante: 0 },
    positions: row.positions,
    stacksBb: row.stacks_bb,
    potBb: row.pot_bb,
    board: row.board,
    history: row.history,
    heroToAct: row.hero_to_act,
  })),
  extractSpotMeta: vi.fn((row: any) => ({
    street: row.street,
    heroPosition: row.hero_position,
    villainPosition: row.villain_position ?? row.hero_position,
    effectiveStackBb: row.effective_stack_bb,
    potType: row.pot_type,
    scenarioType: row.scenario_type,
  })),
}));

// Import after mocking
import { getFilteredSpots } from '@/lib/supabase/spotService';

function makeSupabaseRow(overrides: Record<string, unknown> = {}) {
  return {
    spot_id: 'spot-1',
    street: 'PREFLOP',
    hero_position: 'BTN',
    villain_position: 'BB',
    board: [],
    hero_to_act: 'BTN',
    positions: ['BTN', 'SB', 'BB'],
    stacks_bb: { BTN: 100 },
    pot_bb: 2.5,
    history: [],
    pot_type: 'SRP',
    effective_stack_bb: 99,
    scenario_type: 'open-raise',
    ...overrides,
  };
}

describe('loadSpotsFromSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts Supabase rows to SpotEntry format', async () => {
    (getFilteredSpots as any).mockResolvedValue([makeSupabaseRow()]);

    const supabase = {} as any; // The mock doesn't use the client directly
    const entries = await loadSpotsFromSupabase(supabase, {});

    expect(entries).toHaveLength(1);
    expect(entries[0].spot.spotId).toBe('spot-1');
    expect(entries[0].meta.street).toBe('PREFLOP');
    expect(entries[0].meta.heroPosition).toBe('BTN');
  });

  it('applies filters to Supabase query', async () => {
    (getFilteredSpots as any).mockResolvedValue([]);

    const supabase = {} as any;
    await loadSpotsFromSupabase(supabase, {
      heroPosition: 'CO',
      potType: 'SRP',
      street: 'PREFLOP',
    });

    expect(getFilteredSpots).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        hero_position: 'CO',
        pot_type: 'SRP',
        street: 'PREFLOP',
        is_system: true,
      })
    );
  });

  it('converts stack bucket to min/max range', async () => {
    (getFilteredSpots as any).mockResolvedValue([]);

    const supabase = {} as any;
    await loadSpotsFromSupabase(supabase, {
      effectiveStackBbBucket: '40' as any,
    });

    expect(getFilteredSpots).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        effective_stack_bb_min: 21,
        effective_stack_bb_max: 40,
      })
    );
  });

  it('handles heroPositions array', async () => {
    (getFilteredSpots as any).mockResolvedValue([]);

    const supabase = {} as any;
    await loadSpotsFromSupabase(supabase, {
      heroPositions: ['BTN', 'CO'] as any,
    });

    expect(getFilteredSpots).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        hero_positions: ['BTN', 'CO'],
      })
    );
  });

  it('returns empty array when no spots found', async () => {
    (getFilteredSpots as any).mockResolvedValue([]);

    const supabase = {} as any;
    const result = await loadSpotsFromSupabase(supabase, {});
    expect(result).toEqual([]);
  });
});

describe('clearBundledPackCache', () => {
  it('does not throw', () => {
    expect(() => clearBundledPackCache()).not.toThrow();
  });
});
