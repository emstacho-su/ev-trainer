// src/lib/prisma/json-roundtrip.test.ts
// Test that Spot and DecisionGrade types serialize correctly to JSON
// These types are stored in Prisma JSON fields

import { describe, it, expect } from 'vitest';
import type { Spot } from '../engine/spot';
import type { DecisionGrade } from '../engine/trainingOrchestrator';

describe('JSON round-trip serialization', () => {
  describe('Spot', () => {
    it('should serialize and deserialize correctly', () => {
      const spot: Spot = {
        schemaVersion: '1',
        spotId: 'abc123',
        gameType: 'NLHE',
        blinds: { sb: 0.5, bb: 1 },
        positions: ['BTN', 'SB', 'BB'],
        stacksBb: { BTN: 100, SB: 100, BB: 100 },
        potBb: 1.5,
        board: [],
        history: ['BTN:r2.5'],
        heroToAct: 'SB',
      };

      // Simulate Prisma JSON field storage
      const serialized = JSON.stringify(spot);
      const deserialized = JSON.parse(serialized) as Spot;

      expect(deserialized).toEqual(spot);
      expect(deserialized.schemaVersion).toBe('1');
      expect(deserialized.blinds.sb).toBe(0.5);
      expect(deserialized.positions).toEqual(['BTN', 'SB', 'BB']);
      expect(deserialized.stacksBb.BTN).toBe(100);
    });

    it('should handle postflop spot with board cards', () => {
      const spot: Spot = {
        schemaVersion: '1',
        spotId: 'def456',
        gameType: 'NLHE',
        blinds: { sb: 0.5, bb: 1, ante: 0.1 },
        positions: ['BTN', 'BB'],
        stacksBb: { BTN: 50, BB: 50 },
        potBb: 6.5,
        board: ['As', 'Kh', 'Tc'],
        history: ['BTN:r2.5', 'BB:c'],
        heroToAct: 'BB',
      };

      const serialized = JSON.stringify(spot);
      const deserialized = JSON.parse(serialized) as Spot;

      expect(deserialized.board).toEqual(['As', 'Kh', 'Tc']);
      expect(deserialized.blinds.ante).toBe(0.1);
    });

    it('should handle numeric edge cases', () => {
      const spot: Spot = {
        schemaVersion: '1',
        spotId: 'ghi789',
        gameType: 'NLHE',
        blinds: { sb: 0.5, bb: 1 },
        positions: ['BTN', 'BB'],
        stacksBb: { BTN: 0.123456789, BB: 99.999999 },
        potBb: 0.0001,
        board: [],
        history: [],
        heroToAct: 'BTN',
      };

      const serialized = JSON.stringify(spot);
      const deserialized = JSON.parse(serialized) as Spot;

      expect(deserialized.stacksBb.BTN).toBe(0.123456789);
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
