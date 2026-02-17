// src/lib/engine/spotCorrectness.test.ts
// Tests preflop spot correctness using the bundled pack.

import { describe, it, expect, beforeAll } from 'vitest';
import { loadBundledPack, clearBundledPackCache } from '../../lib/v2/packs/loadBundledPack';
import type { SpotPack, SpotEntry } from '../../lib/v2/packs/spotPack';
import { Positions, type Position } from './types';

let pack: SpotPack;

beforeAll(() => {
  clearBundledPackCache();
  pack = loadBundledPack();
});

describe('preflop spot correctness from bundled pack', () => {
  it('pack loads successfully with spots', () => {
    expect(pack).toBeDefined();
    expect(pack.spots.length).toBeGreaterThan(0);
    expect(pack.packId).toBeTruthy();
  });

  it('all spots have valid positions array', () => {
    for (const entry of pack.spots) {
      expect(entry.spot.positions.length).toBeGreaterThan(0);
      for (const pos of entry.spot.positions) {
        expect(Positions).toContain(pos);
      }
    }
  });

  it('all spots have valid heroToAct', () => {
    for (const entry of pack.spots) {
      expect(Positions).toContain(entry.spot.heroToAct);
      expect(entry.spot.positions).toContain(entry.spot.heroToAct);
    }
  });

  it('preflop spots have empty boards', () => {
    const preflopSpots = pack.spots.filter((e) => e.meta.street === 'PREFLOP');

    // Should have at least some preflop spots
    expect(preflopSpots.length).toBeGreaterThan(0);

    for (const entry of preflopSpots) {
      expect(entry.spot.board).toEqual([]);
    }
  });

  it('flop spots have exactly 3 board cards', () => {
    const flopSpots = pack.spots.filter((e) => e.meta.street === 'FLOP');

    for (const entry of flopSpots) {
      expect(entry.spot.board).toHaveLength(3);
    }
  });

  it('all spots have valid game type NLHE', () => {
    for (const entry of pack.spots) {
      expect(entry.spot.gameType).toBe('NLHE');
    }
  });

  it('all spots have schema version 1', () => {
    for (const entry of pack.spots) {
      expect(entry.spot.schemaVersion).toBe('1');
    }
  });

  it('all spots have positive blinds', () => {
    for (const entry of pack.spots) {
      expect(entry.spot.blinds.sb).toBeGreaterThan(0);
      expect(entry.spot.blinds.bb).toBeGreaterThan(0);
    }
  });

  it('all spots have non-negative pot', () => {
    for (const entry of pack.spots) {
      expect(entry.spot.potBb).toBeGreaterThanOrEqual(0);
    }
  });

  it('all spots have stacks for all listed positions', () => {
    for (const entry of pack.spots) {
      for (const pos of entry.spot.positions) {
        expect(entry.spot.stacksBb[pos]).toBeDefined();
        expect(entry.spot.stacksBb[pos]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('all spots have non-empty spotId', () => {
    for (const entry of pack.spots) {
      expect(entry.spot.spotId).toBeTruthy();
      expect(entry.spot.spotId.length).toBeGreaterThan(0);
    }
  });

  it('all spotIds are unique within the pack', () => {
    const ids = pack.spots.map((e) => e.spot.spotId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('position ordering within spots uses valid positions', () => {
    const validPositionSet = new Set<string>(Positions);

    for (const entry of pack.spots) {
      for (const pos of entry.spot.positions) {
        expect(validPositionSet.has(pos)).toBe(true);
      }
      // No duplicate positions
      const uniquePositions = new Set(entry.spot.positions);
      expect(uniquePositions.size).toBe(entry.spot.positions.length);
    }
  });

  it('meta heroPosition and villainPosition are in spot positions', () => {
    for (const entry of pack.spots) {
      expect(entry.spot.positions).toContain(entry.meta.heroPosition);
      expect(entry.spot.positions).toContain(entry.meta.villainPosition);
    }
  });

  it('history is an array of strings', () => {
    for (const entry of pack.spots) {
      expect(Array.isArray(entry.spot.history)).toBe(true);
      for (const action of entry.spot.history) {
        expect(typeof action).toBe('string');
        expect(action.length).toBeGreaterThan(0);
      }
    }
  });
});
