// src/__tests__/solverContract.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateSolverNodeOutput,
  type SolverNodeOutput,
  type SolverActionOutput,
} from '../lib/engine/solverAdapter';

/**
 * Solver contract tests — validate that SolverNodeOutput conforms to the
 * engine's expected contract. These tests exercise validateSolverNodeOutput()
 * against valid and invalid payloads to ensure the contract is airtight.
 */

function makeValidOutput(overrides?: Partial<SolverNodeOutput>): SolverNodeOutput {
  return {
    status: 'ok',
    units: 'bb',
    actions: [
      { actionId: 'FOLD', frequency: 0.3, ev: -0.5 },
      { actionId: 'CALL', frequency: 0.5, ev: 1.2 },
      { actionId: 'RAISE_3', frequency: 0.2, ev: 2.1 },
    ],
    ...overrides,
  };
}

function makeAction(overrides?: Partial<SolverActionOutput>): SolverActionOutput {
  return {
    actionId: 'FOLD',
    frequency: 1.0,
    ev: 0,
    ...overrides,
  };
}

describe('Solver Contract: validateSolverNodeOutput', () => {
  describe('valid outputs pass validation', () => {
    it('accepts a well-formed ok output', () => {
      const output = makeValidOutput();
      expect(() => validateSolverNodeOutput(output)).not.toThrow();
    });

    it('accepts unsolved status with empty actions', () => {
      const output = makeValidOutput({ status: 'unsolved', actions: [] });
      expect(() => validateSolverNodeOutput(output)).not.toThrow();
    });

    it('accepts error status with empty actions', () => {
      const output = makeValidOutput({ status: 'error', actions: [] });
      expect(() => validateSolverNodeOutput(output)).not.toThrow();
    });

    it('accepts output with optional nodeId', () => {
      const output = makeValidOutput({ nodeId: 'SB:AA:PREFLOP' });
      const result = validateSolverNodeOutput(output);
      expect(result.nodeId).toBe('SB:AA:PREFLOP');
    });

    it('accepts output with optional exploitability', () => {
      const output = makeValidOutput({ exploitability: 0.0023 });
      const result = validateSolverNodeOutput(output);
      expect(result.exploitability).toBe(0.0023);
    });

    it('accepts chips as units', () => {
      const output = makeValidOutput({ units: 'chips' });
      expect(() => validateSolverNodeOutput(output)).not.toThrow();
    });

    it('returns the validated output object', () => {
      const output = makeValidOutput();
      const result = validateSolverNodeOutput(output);
      expect(result.status).toBe('ok');
      expect(result.actions).toHaveLength(3);
    });
  });

  describe('frequency constraints', () => {
    it('rejects ok output with frequencies not summing to 1.0', () => {
      const output = makeValidOutput({
        actions: [
          { actionId: 'FOLD', frequency: 0.3, ev: 0 },
          { actionId: 'CALL', frequency: 0.3, ev: 0 },
        ],
      });
      expect(() => validateSolverNodeOutput(output)).toThrow(/frequency sum/);
    });

    it('accepts frequencies summing to 1.0 within epsilon', () => {
      const output = makeValidOutput({
        actions: [
          { actionId: 'FOLD', frequency: 0.33333, ev: 0 },
          { actionId: 'CALL', frequency: 0.33334, ev: 0 },
          { actionId: 'RAISE', frequency: 0.33333, ev: 0 },
        ],
      });
      expect(() => validateSolverNodeOutput(output)).not.toThrow();
    });

    it('rejects negative frequency', () => {
      const output = makeValidOutput({
        actions: [
          { actionId: 'FOLD', frequency: -0.1, ev: 0 },
          { actionId: 'CALL', frequency: 1.1, ev: 0 },
        ],
      });
      expect(() => validateSolverNodeOutput(output)).toThrow(/frequency/);
    });

    it('rejects frequency > 1', () => {
      const output = makeValidOutput({
        actions: [{ actionId: 'FOLD', frequency: 1.5, ev: 0 }],
      });
      expect(() => validateSolverNodeOutput(output)).toThrow(/frequency/);
    });
  });

  describe('action constraints', () => {
    it('rejects ok status with no actions', () => {
      const output = makeValidOutput({ actions: [] });
      expect(() => validateSolverNodeOutput(output)).toThrow(/actions/);
    });

    it('rejects duplicate actionIds', () => {
      const output = makeValidOutput({
        actions: [
          { actionId: 'FOLD', frequency: 0.5, ev: 0 },
          { actionId: 'FOLD', frequency: 0.5, ev: 1 },
        ],
      });
      expect(() => validateSolverNodeOutput(output)).toThrow(/duplicate/i);
    });

    it('rejects empty actionId string', () => {
      const output = makeValidOutput({
        actions: [{ actionId: '', frequency: 1.0, ev: 0 }],
      });
      expect(() => validateSolverNodeOutput(output)).toThrow(/actionId/);
    });

    it('rejects NaN ev', () => {
      const output = makeValidOutput({
        actions: [{ actionId: 'FOLD', frequency: 1.0, ev: NaN }],
      });
      expect(() => validateSolverNodeOutput(output)).toThrow(/finite number/);
    });

    it('rejects Infinity frequency', () => {
      const output = makeValidOutput({
        actions: [{ actionId: 'FOLD', frequency: Infinity, ev: 0 }],
      });
      expect(() => validateSolverNodeOutput(output)).toThrow(/finite number/);
    });

    it('rejects non-object action', () => {
      const output = makeValidOutput({ actions: ['FOLD'] as any });
      expect(() => validateSolverNodeOutput(output)).toThrow();
    });
  });

  describe('top-level field validation', () => {
    it('rejects null output', () => {
      expect(() => validateSolverNodeOutput(null)).toThrow(/object/);
    });

    it('rejects non-object output', () => {
      expect(() => validateSolverNodeOutput('hello')).toThrow(/object/);
    });

    it('rejects invalid status', () => {
      const output = makeValidOutput({ status: 'pending' as any });
      expect(() => validateSolverNodeOutput(output)).toThrow(/status/);
    });

    it('rejects invalid units', () => {
      const output = makeValidOutput({ units: 'dollars' as any });
      expect(() => validateSolverNodeOutput(output)).toThrow(/units/);
    });

    it('rejects non-array actions', () => {
      const output = { ...makeValidOutput(), actions: 'not-array' };
      expect(() => validateSolverNodeOutput(output)).toThrow(/array/);
    });

    it('rejects empty nodeId string', () => {
      const output = makeValidOutput({ nodeId: '' });
      expect(() => validateSolverNodeOutput(output)).toThrow(/nodeId/);
    });

    it('rejects non-finite exploitability', () => {
      const output = makeValidOutput({ exploitability: NaN });
      expect(() => validateSolverNodeOutput(output)).toThrow(/finite number/);
    });
  });

  describe('reference solver outputs', () => {
    it('validates a GTO push/fold scenario output', () => {
      const pushFold: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        nodeId: 'SB:push-fold',
        exploitability: 0.05,
        actions: [
          { actionId: 'FOLD', frequency: 0.52, ev: -0.5 },
          { actionId: 'ALL_IN', frequency: 0.48, ev: 1.8 },
        ],
      };
      const result = validateSolverNodeOutput(pushFold);
      expect(result.status).toBe('ok');
      expect(result.actions).toHaveLength(2);
    });

    it('validates a multi-size betting output', () => {
      const multiBet: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        actions: [
          { actionId: 'CHECK', frequency: 0.25, ev: 0.3 },
          { actionId: 'BET_0.33', frequency: 0.35, ev: 0.8 },
          { actionId: 'BET_0.67', frequency: 0.20, ev: 0.6 },
          { actionId: 'BET_1.0', frequency: 0.15, ev: 0.4 },
          { actionId: 'ALL_IN', frequency: 0.05, ev: -0.2 },
        ],
      };
      const result = validateSolverNodeOutput(multiBet);
      expect(result.actions).toHaveLength(5);
    });

    it('validates a postflop turn output', () => {
      const turn: SolverNodeOutput = {
        status: 'ok',
        units: 'bb',
        nodeId: 'IP:turn:Ah-Kd-7c-2s',
        exploitability: 0.12,
        actions: [
          { actionId: 'CHECK', frequency: 0.40, ev: 2.1 },
          { actionId: 'BET_0.75', frequency: 0.60, ev: 3.5 },
        ],
      };
      expect(() => validateSolverNodeOutput(turn)).not.toThrow();
    });
  });
});
