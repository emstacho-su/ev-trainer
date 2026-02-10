// src/lib/prisma/json-roundtrip.test.ts
// Test that Spot and DecisionGrade types serialize correctly to JSON
// These types are stored in Prisma JSON fields

import { describe, it, expect } from 'vitest';
import type { Spot } from '../engine/spot';
import type { DecisionGrade } from '../engine/trainingOrchestrator';

// Helper to create minimal valid Spot for testing JSON serialization
// Note: In production, Spots come from spot packs and have full Position records
function createTestSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    schemaVersion: '1',
    spotId: 'test-spot-id',
    gameType: 'NLHE',
    blinds: { sb: 0.5, bb: 1 },
    positions: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
    stacksBb: { SB: 100, BB: 100, UTG: 100, HJ: 100, CO: 100, BTN: 100 },
    potBb: 1.5,
    board: [],
    history: [],
    heroToAct: 'BTN',
    ...overrides,
  };
}

describe('JSON round-trip serialization', () => {
  describe('Spot', () => {
    it('should serialize and deserialize correctly', () => {
      const spot = createTestSpot({
        spotId: 'abc123',
        history: ['BTN:r2.5'],
        heroToAct: 'SB',
      });

      // Simulate Prisma JSON field storage
      const serialized = JSON.stringify(spot);
      const deserialized = JSON.parse(serialized) as Spot;

      expect(deserialized).toEqual(spot);
      expect(deserialized.schemaVersion).toBe('1');
      expect(deserialized.blinds.sb).toBe(0.5);
      expect(deserialized.positions).toEqual(['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']);
      expect(deserialized.stacksBb.BTN).toBe(100);
    });

    it('should handle postflop spot with board cards', () => {
      const spot = createTestSpot({
        spotId: 'def456',
        blinds: { sb: 0.5, bb: 1, ante: 0.1 },
        stacksBb: { SB: 50, BB: 50, UTG: 50, HJ: 50, CO: 50, BTN: 50 },
        potBb: 6.5,
        board: ['As', 'Kh', 'Tc'],
        history: ['BTN:r2.5', 'BB:c'],
        heroToAct: 'BB',
      });

      const serialized = JSON.stringify(spot);
      const deserialized = JSON.parse(serialized) as Spot;

      expect(deserialized.board).toEqual(['As', 'Kh', 'Tc']);
      expect(deserialized.blinds.ante).toBe(0.1);
    });

    it('should handle numeric edge cases', () => {
      const spot = createTestSpot({
        spotId: 'ghi789',
        stacksBb: { SB: 0.123456789, BB: 99.999999, UTG: 100, HJ: 100, CO: 100, BTN: 100 },
        potBb: 0.0001,
      });

      const serialized = JSON.stringify(spot);
      const deserialized = JSON.parse(serialized) as Spot;

      expect(deserialized.stacksBb.SB).toBe(0.123456789);
      expect(deserialized.stacksBb.BB).toBe(99.999999);
      expect(deserialized.potBb).toBe(0.0001);
    });
  });

  describe('DecisionGrade', () => {
    it('should serialize and deserialize correctly', () => {
      const grade: DecisionGrade = {
        evUser: 1.5,
        evMix: 2.0,
        evBest: 2.5,
        evLossVsMix: 0.5,
        evLossVsBest: 1.0,
        pureMistake: false,
        policyDivergence: 0.15,
        isBestAction: false,
        gradeLabel: 'Good',
      };

      const serialized = JSON.stringify(grade);
      const deserialized = JSON.parse(serialized) as DecisionGrade;

      expect(deserialized).toEqual(grade);
      expect(deserialized.evUser).toBe(1.5);
      expect(deserialized.pureMistake).toBe(false);
      expect(deserialized.gradeLabel).toBe('Good');
    });

    it('should handle optimal action grade', () => {
      const grade: DecisionGrade = {
        evUser: 2.5,
        evMix: 2.5,
        evBest: 2.5,
        evLossVsMix: 0,
        evLossVsBest: 0,
        pureMistake: false,
        policyDivergence: 0,
        isBestAction: true,
      };

      const serialized = JSON.stringify(grade);
      const deserialized = JSON.parse(serialized) as DecisionGrade;

      expect(deserialized.isBestAction).toBe(true);
      expect(deserialized.evLossVsBest).toBe(0);
      expect(deserialized.gradeLabel).toBeUndefined();
    });

    it('should handle pure mistake grade', () => {
      const grade: DecisionGrade = {
        evUser: -5.0,
        evMix: 1.0,
        evBest: 2.0,
        evLossVsMix: 6.0,
        evLossVsBest: 7.0,
        pureMistake: true,
        policyDivergence: 1.0,
        isBestAction: false,
        gradeLabel: 'Mistake',
      };

      const serialized = JSON.stringify(grade);
      const deserialized = JSON.parse(serialized) as DecisionGrade;

      expect(deserialized.pureMistake).toBe(true);
      expect(deserialized.evUser).toBe(-5.0);
    });

    it('should handle negative EV values', () => {
      const grade: DecisionGrade = {
        evUser: -0.5,
        evMix: -0.25,
        evBest: 0.1,
        evLossVsMix: 0.25,
        evLossVsBest: 0.6,
        pureMistake: false,
        policyDivergence: 0.3,
        isBestAction: false,
      };

      const serialized = JSON.stringify(grade);
      const deserialized = JSON.parse(serialized) as DecisionGrade;

      expect(deserialized.evUser).toBe(-0.5);
      expect(deserialized.evMix).toBe(-0.25);
    });
  });
});
