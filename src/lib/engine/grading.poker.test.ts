// src/lib/engine/grading.poker.test.ts
// Poker-specific grading validation tests with known solver outputs.

import { describe, it, expect } from 'vitest';
import type { SolverNodeOutput } from './solverAdapter';
import { gradeDecision, type ScoringConfig } from './grading';

function makeSolverOutput(
  actions: Array<{ actionId: string; frequency: number; ev: number }>,
  status: 'ok' | 'unsolved' | 'error' = 'ok',
): SolverNodeOutput {
  return { status, units: 'bb', actions };
}

describe('grading poker scenarios', () => {
  describe('pure strategy (100% one action)', () => {
    it('EV loss is 0 when choosing the pure action', () => {
      const output = makeSolverOutput([
        { actionId: 'FOLD', frequency: 1.0, ev: -0.5 },
      ]);

      const grade = gradeDecision(output, 'FOLD');

      expect(grade.evUser).toBeCloseTo(-0.5);
      expect(grade.evMix).toBeCloseTo(-0.5);
      expect(grade.evBest).toBeCloseTo(-0.5);
      expect(grade.evLossVsMix).toBeCloseTo(0);
      expect(grade.evLossVsBest).toBeCloseTo(0);
      expect(grade.isBestAction).toBe(true);
      expect(grade.pureMistake).toBe(false);
    });
  });

  describe('mixed strategy EV loss calculation', () => {
    it('calculates EV loss vs mix and vs best correctly', () => {
      // CHECK 60% EV=1.2, BET 40% EV=0.4
      // evMix = 0.6*1.2 + 0.4*0.4 = 0.72 + 0.16 = 0.88
      // evBest = 1.2 (CHECK)
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 0.6, ev: 1.2 },
        { actionId: 'BET_75PCT', frequency: 0.4, ev: 0.4 },
      ]);

      const grade = gradeDecision(output, 'BET_75PCT');

      expect(grade.evUser).toBeCloseTo(0.4);
      expect(grade.evMix).toBeCloseTo(0.88);
      expect(grade.evBest).toBeCloseTo(1.2);
      expect(grade.evLossVsMix).toBeCloseTo(0.48);
      expect(grade.evLossVsBest).toBeCloseTo(0.8);
      expect(grade.isBestAction).toBe(false);
      expect(grade.pureMistake).toBe(true);
    });

    it('choosing best action in mixed strategy has 0 loss vs best', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 0.6, ev: 1.2 },
        { actionId: 'BET_75PCT', frequency: 0.4, ev: 0.4 },
      ]);

      const grade = gradeDecision(output, 'CHECK');

      expect(grade.evLossVsBest).toBeCloseTo(0);
      expect(grade.isBestAction).toBe(true);
      // Loss vs mix is negative (user did better than mix)
      expect(grade.evLossVsMix).toBeCloseTo(-0.32);
    });
  });

  describe('equal EV actions', () => {
    it('all actions have equal EV: any choice has 0 loss', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 0.5, ev: 1.0 },
        { actionId: 'BET_50PCT', frequency: 0.5, ev: 1.0 },
      ]);

      const gradeCheck = gradeDecision(output, 'CHECK');
      const gradeBet = gradeDecision(output, 'BET_50PCT');

      expect(gradeCheck.evLossVsMix).toBeCloseTo(0);
      expect(gradeCheck.evLossVsBest).toBeCloseTo(0);
      expect(gradeCheck.isBestAction).toBe(true);

      expect(gradeBet.evLossVsMix).toBeCloseTo(0);
      expect(gradeBet.evLossVsBest).toBeCloseTo(0);
      expect(gradeBet.isBestAction).toBe(true);
    });

    it('three equal-EV actions all report isBestAction', () => {
      const output = makeSolverOutput([
        { actionId: 'FOLD', frequency: 0.33, ev: 0 },
        { actionId: 'CALL', frequency: 0.34, ev: 0 },
        { actionId: 'RAISE', frequency: 0.33, ev: 0 },
      ]);

      for (const actionId of ['FOLD', 'CALL', 'RAISE']) {
        const grade = gradeDecision(output, actionId);
        expect(grade.isBestAction).toBe(true);
        expect(grade.evLossVsBest).toBeCloseTo(0);
      }
    });
  });

  describe('negative EV spots', () => {
    it('loss is positive when choosing worst action in negative EV spot', () => {
      // All actions are negative EV, but CALL is least bad
      const output = makeSolverOutput([
        { actionId: 'FOLD', frequency: 0.3, ev: -1.0 },
        { actionId: 'CALL', frequency: 0.7, ev: -0.2 },
      ]);

      const grade = gradeDecision(output, 'FOLD');

      expect(grade.evUser).toBeCloseTo(-1.0);
      expect(grade.evBest).toBeCloseTo(-0.2);
      expect(grade.evLossVsBest).toBeCloseTo(0.8);
      expect(grade.evLossVsBest).toBeGreaterThan(0);
      expect(grade.pureMistake).toBe(true);
    });

    it('choosing best in negative EV spot has 0 loss vs best', () => {
      const output = makeSolverOutput([
        { actionId: 'FOLD', frequency: 0.3, ev: -1.0 },
        { actionId: 'CALL', frequency: 0.7, ev: -0.2 },
      ]);

      const grade = gradeDecision(output, 'CALL');

      expect(grade.evLossVsBest).toBeCloseTo(0);
      expect(grade.isBestAction).toBe(true);
    });
  });

  describe('grade labels with custom thresholds', () => {
    const thresholds = { excellent: 0.05, good: 0.2, ok: 0.5 };

    it('grade A: loss <= 0.05 bb', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 0.5, ev: 1.0 },
        { actionId: 'BET', frequency: 0.5, ev: 0.98 },
      ]);

      const grade = gradeDecision(output, 'BET', { thresholds });
      // evLossVsBest = 1.0 - 0.98 = 0.02
      expect(grade.gradeLabel).toBe('A');
    });

    it('grade B: loss between 0.05 and 0.2 bb', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 0.6, ev: 1.0 },
        { actionId: 'BET', frequency: 0.4, ev: 0.85 },
      ]);

      const grade = gradeDecision(output, 'BET', { thresholds });
      // evLossVsBest = 1.0 - 0.85 = 0.15
      expect(grade.gradeLabel).toBe('B');
    });

    it('grade C: loss between 0.2 and 0.5 bb', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 0.7, ev: 1.0 },
        { actionId: 'BET', frequency: 0.3, ev: 0.65 },
      ]);

      const grade = gradeDecision(output, 'BET', { thresholds });
      // evLossVsBest = 1.0 - 0.65 = 0.35
      expect(grade.gradeLabel).toBe('C');
    });

    it('grade D: loss > 0.5 bb', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 0.8, ev: 1.0 },
        { actionId: 'BET', frequency: 0.2, ev: 0.2 },
      ]);

      const grade = gradeDecision(output, 'BET', { thresholds });
      // evLossVsBest = 1.0 - 0.2 = 0.8
      expect(grade.gradeLabel).toBe('D');
    });

    it('gradeBy evLossVsMix uses mix as reference', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 0.6, ev: 1.0 },
        { actionId: 'BET', frequency: 0.4, ev: 0.4 },
      ]);
      // evMix = 0.6*1.0 + 0.4*0.4 = 0.76
      // evLossVsMix for BET = 0.76 - 0.4 = 0.36 -> grade C

      const grade = gradeDecision(output, 'BET', {
        thresholds,
        gradeBy: 'evLossVsMix',
      });
      expect(grade.gradeLabel).toBe('C');
    });

    it('no grade label when thresholds not provided', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 1.0, ev: 1.0 },
      ]);

      const grade = gradeDecision(output, 'CHECK');
      expect(grade.gradeLabel).toBeUndefined();
    });
  });

  describe('policy divergence', () => {
    it('choosing 100% frequency action has 0 divergence', () => {
      const output = makeSolverOutput([
        { actionId: 'CALL', frequency: 1.0, ev: 0.5 },
      ]);

      const grade = gradeDecision(output, 'CALL');
      expect(grade.policyDivergence).toBeCloseTo(0);
    });

    it('choosing 0-frequency action has max divergence', () => {
      const output = makeSolverOutput([
        { actionId: 'CHECK', frequency: 1.0, ev: 1.0 },
        { actionId: 'BET', frequency: 0, ev: 0.5 },
      ]);

      const grade = gradeDecision(output, 'BET');
      expect(grade.policyDivergence).toBeCloseTo(1);
    });
  });

  describe('allActions in grade output', () => {
    it('includes all solver actions with their data', () => {
      const output = makeSolverOutput([
        { actionId: 'FOLD', frequency: 0.1, ev: -0.5 },
        { actionId: 'CALL', frequency: 0.5, ev: 0.8 },
        { actionId: 'RAISE', frequency: 0.4, ev: 1.2 },
      ]);

      const grade = gradeDecision(output, 'CALL');

      expect(grade.allActions).toHaveLength(3);
      expect(grade.allActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actionId: 'FOLD', frequency: 0.1, ev: -0.5 }),
          expect.objectContaining({ actionId: 'CALL', frequency: 0.5, ev: 0.8 }),
          expect.objectContaining({ actionId: 'RAISE', frequency: 0.4, ev: 1.2 }),
        ]),
      );
    });
  });
});
