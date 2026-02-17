// src/lib/engine/actionValidity.test.ts
// Tests that gradeDecision throws for invalid actions and solver states.

import { describe, it, expect } from 'vitest';
import type { SolverNodeOutput } from './solverAdapter';
import { gradeDecision } from './grading';

describe('gradeDecision action validity', () => {
  describe('user action not in solver output', () => {
    it('throws when submitting an action not in solver output', () => {
      const output: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        actions: [
          { actionId: 'CHECK', frequency: 0.6, ev: 1.0 },
          { actionId: 'BET_50PCT', frequency: 0.4, ev: 0.8 },
        ],
      };

      expect(() => gradeDecision(output, 'FOLD')).toThrow(
        'user action not in solver output',
      );
    });

    it('throws with exact action ID mismatch (case sensitive)', () => {
      const output: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        actions: [
          { actionId: 'CALL', frequency: 1.0, ev: 0.5 },
        ],
      };

      expect(() => gradeDecision(output, 'call')).toThrow(
        'user action not in solver output',
      );
    });

    it('throws for empty string action ID', () => {
      const output: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        actions: [
          { actionId: 'CHECK', frequency: 1.0, ev: 0.0 },
        ],
      };

      expect(() => gradeDecision(output, '')).toThrow(
        'user action not in solver output',
      );
    });
  });

  describe('solver output with non-ok status', () => {
    it('throws for unsolved status', () => {
      const output: SolverNodeOutput = {
        status: 'unsolved',
        units: 'bb',
        actions: [],
      };

      expect(() => gradeDecision(output, 'FOLD')).toThrow(
        "gradeDecision requires solver output status 'ok'",
      );
    });

    it('throws for error status', () => {
      const output: SolverNodeOutput = {
        status: 'error',
        units: 'bb',
        actions: [],
      };

      expect(() => gradeDecision(output, 'FOLD')).toThrow(
        "gradeDecision requires solver output status 'ok'",
      );
    });
  });

  describe('solver output with empty actions', () => {
    it('throws for ok status with empty actions array', () => {
      const output: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        actions: [],
      };

      expect(() => gradeDecision(output, 'CHECK')).toThrow(
        'gradeDecision requires non-empty solver actions',
      );
    });
  });

  describe('invalid numeric values in solver output', () => {
    it('throws for NaN frequency', () => {
      const output: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        actions: [
          { actionId: 'CHECK', frequency: NaN, ev: 1.0 },
        ],
      };

      expect(() => gradeDecision(output, 'CHECK')).toThrow('finite number');
    });

    it('throws for Infinity ev', () => {
      const output: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        actions: [
          { actionId: 'CHECK', frequency: 1.0, ev: Infinity },
        ],
      };

      expect(() => gradeDecision(output, 'CHECK')).toThrow('finite number');
    });
  });

  describe('multiple valid actions with one invalid request', () => {
    it('throws only for missing action, not present ones', () => {
      const output: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        actions: [
          { actionId: 'FOLD', frequency: 0.2, ev: -0.5 },
          { actionId: 'CALL', frequency: 0.5, ev: 0.3 },
          { actionId: 'RAISE_3X', frequency: 0.3, ev: 0.8 },
        ],
      };

      // Valid actions work
      expect(() => gradeDecision(output, 'FOLD')).not.toThrow();
      expect(() => gradeDecision(output, 'CALL')).not.toThrow();
      expect(() => gradeDecision(output, 'RAISE_3X')).not.toThrow();

      // Missing action throws
      expect(() => gradeDecision(output, 'ALL_IN')).toThrow(
        'user action not in solver output',
      );
    });
  });
});
