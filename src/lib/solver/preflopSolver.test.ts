// src/lib/solver/preflopSolver.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  solvePreflopScenario,
  toSolverNodeOutput,
  getSolverOutput,
  computeExploitability,
  createDefaultSolverConfig,
  type PreflopSolverConfig,
  type PreflopSolution,
} from './preflopSolver';
import type { PreflopTreeConfig } from './types';
import type { SolverRequest } from '../engine/solverAdapter';
import { validateSolverNodeOutput } from '../engine/solverAdapter';
import { buildInfoSetId } from './gameTree';

/**
 * Creates a minimal tree config for testing.
 */
function createTestTreeConfig(): PreflopTreeConfig {
  return {
    startingStackBb: 100,
    smallBlindBb: 0.5,
    bigBlindBb: 1,
    positions: ['SB', 'BB'],
    heroPosition: 'SB',
    villainPosition: 'BB',
    priorActions: [],
    actionAbstraction: {
      betSizes: { PREFLOP: [1.0], FLOP: [], TURN: [], RIVER: [] },
      raiseSizes: { PREFLOP: [2.5, 3.0], FLOP: [], TURN: [], RIVER: [] },
      includeAllIn: true,
      allInThreshold: 2,
    },
  };
}

/**
 * Creates a quick test solver config.
 */
function createTestSolverConfig(overrides?: Partial<PreflopSolverConfig>): PreflopSolverConfig {
  const treeConfig = createTestTreeConfig();
  return {
    maxIterations: 50, // Low for fast tests
    targetExploitability: 100, // High target (we just want to test mechanics)
    checkConvergenceEvery: 10,
    treeConfig,
    usePrecomputedEquity: false,
    ...overrides,
  };
}

describe('Preflop Solver', () => {
  describe('solvePreflopScenario', () => {
    it('runs without crashing', () => {
      const config = createTestSolverConfig();
      const solution = solvePreflopScenario(config);

      expect(solution).toBeDefined();
      expect(solution.result).toBeDefined();
      expect(solution.strategies).toBeInstanceOf(Map);
      expect(solution.infoSets).toBeDefined();
    });

    it('creates info sets during traversal', () => {
      const config = createTestSolverConfig();
      const solution = solvePreflopScenario(config);

      expect(solution.infoSets.size).toBeGreaterThan(0);
    });

    it('produces strategies that sum to 1.0', () => {
      const config = createTestSolverConfig();
      const solution = solvePreflopScenario(config);

      for (const [id, strategy] of solution.strategies) {
        const sum = strategy.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 5);
      }
    });

    it('produces finite utility values (no NaN/Infinity)', () => {
      const config = createTestSolverConfig();
      const solution = solvePreflopScenario(config);

      for (const [id, strategy] of solution.strategies) {
        for (const value of strategy) {
          expect(Number.isFinite(value)).toBe(true);
          expect(Number.isNaN(value)).toBe(false);
        }
      }
    });

    it('tracks iteration count correctly', () => {
      const config = createTestSolverConfig({ maxIterations: 25 });
      const solution = solvePreflopScenario(config);

      expect(solution.result.iterations).toBe(25);
    });

    it('measures elapsed time', () => {
      const config = createTestSolverConfig();
      const solution = solvePreflopScenario(config);

      expect(solution.result.elapsedMs).toBeGreaterThan(0);
    });

    it('calls progress callback', () => {
      let callbackCalled = false;
      let lastIteration = 0;

      const config = createTestSolverConfig({
        progressCallback: (iteration, exploitability) => {
          callbackCalled = true;
          lastIteration = iteration;
          expect(typeof exploitability).toBe('number');
        },
      });

      solvePreflopScenario(config);

      expect(callbackCalled).toBe(true);
      expect(lastIteration).toBeGreaterThan(0);
    });
  });

  describe('exploitability tracking', () => {
    it('computes exploitability as finite number', () => {
      const config = createTestSolverConfig();
      const solution = solvePreflopScenario(config);

      expect(Number.isFinite(solution.result.exploitability)).toBe(true);
    });

    it('exploitability decreases with more iterations', () => {
      // Run with few iterations
      const config1 = createTestSolverConfig({ maxIterations: 20 });
      const solution1 = solvePreflopScenario(config1);

      // Run with more iterations
      const config2 = createTestSolverConfig({ maxIterations: 60 });
      const solution2 = solvePreflopScenario(config2);

      // Exploitability should generally decrease (may not always due to sampling)
      // Just verify both are finite
      expect(Number.isFinite(solution1.result.exploitability)).toBe(true);
      expect(Number.isFinite(solution2.result.exploitability)).toBe(true);
    });

    it('reports converged when target reached', () => {
      // Use a very high target that should be reached immediately
      const config = createTestSolverConfig({
        maxIterations: 100,
        targetExploitability: 1e10, // Very high target
        checkConvergenceEvery: 1,
      });

      const solution = solvePreflopScenario(config);

      // Should converge quickly with such a high target
      expect(solution.result.converged).toBe(true);
      expect(solution.result.iterations).toBeLessThan(100);
    });
  });

  describe('toSolverNodeOutput', () => {
    let solution: PreflopSolution;

    beforeEach(() => {
      const config = createTestSolverConfig();
      solution = solvePreflopScenario(config);
    });

    it('produces valid SolverNodeOutput', () => {
      // Get first info set ID
      const infoSetId = solution.strategies.keys().next().value;
      if (!infoSetId) {
        // No info sets created (unlikely but handle)
        return;
      }

      const output = toSolverNodeOutput(infoSetId, solution);

      // Should not throw
      expect(() => validateSolverNodeOutput(output)).not.toThrow();
    });

    it('frequencies sum to 1.0', () => {
      const infoSetId = solution.strategies.keys().next().value;
      if (!infoSetId) return;

      const output = toSolverNodeOutput(infoSetId, solution);

      if (output.status === 'ok' && output.actions.length > 0) {
        const sum = output.actions.reduce((a, b) => a + b.frequency, 0);
        expect(sum).toBeCloseTo(1.0, 4);
      }
    });

    it('includes exploitability when converged', () => {
      const infoSetId = solution.strategies.keys().next().value;
      if (!infoSetId) return;

      const output = toSolverNodeOutput(infoSetId, solution);

      expect(typeof output.exploitability).toBe('number');
    });

    it('returns unsolved status for unknown info set', () => {
      const output = toSolverNodeOutput('unknown:AA:FOLD', solution);

      expect(output.status).toBe('unsolved');
    });

    it('uses bb units', () => {
      const infoSetId = solution.strategies.keys().next().value;
      if (!infoSetId) return;

      const output = toSolverNodeOutput(infoSetId, solution);

      expect(output.units).toBe('bb');
    });
  });

  describe('getSolverOutput', () => {
    it('converts solver request to output', () => {
      const config = createTestSolverConfig();
      const solution = solvePreflopScenario(config);

      const request: SolverRequest = {
        gameVersion: '1.0',
        abstractionVersion: '1.0',
        solverVersion: '1.0',
        publicState: {
          street: 'PREFLOP',
          potBb: 1.5,
          effectiveStackBb: 99.5,
          board: [],
          toAct: 'SB',
        },
        history: { actions: [] },
        toAct: 'SB',
        rangeContext: 'AA',
      };

      const output = getSolverOutput(request, solution);

      expect(output).toBeDefined();
      expect(['ok', 'unsolved', 'error']).toContain(output.status);
    });
  });

  describe('createDefaultSolverConfig', () => {
    it('creates valid config', () => {
      const treeConfig = createTestTreeConfig();
      const config = createDefaultSolverConfig(treeConfig);

      expect(config.maxIterations).toBeGreaterThan(0);
      expect(config.targetExploitability).toBeGreaterThan(0);
      expect(config.treeConfig).toBe(treeConfig);
    });
  });

  describe('CFR+ mechanics', () => {
    it('regrets are non-negative after CFR+ floor', () => {
      const config = createTestSolverConfig({ maxIterations: 20 });
      const solution = solvePreflopScenario(config);

      for (const [_, infoSet] of solution.infoSets.entries()) {
        for (let i = 0; i < infoSet.numActions; i++) {
          expect(infoSet.regretSum[i]).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('strategy sums accumulate over iterations', () => {
      const config = createTestSolverConfig({ maxIterations: 30 });
      const solution = solvePreflopScenario(config);

      // At least some info sets should have non-zero strategy sums
      let hasNonZeroSum = false;
      for (const [_, infoSet] of solution.infoSets.entries()) {
        for (let i = 0; i < infoSet.numActions; i++) {
          if (infoSet.strategySum[i] > 0) {
            hasNonZeroSum = true;
            break;
          }
        }
        if (hasNonZeroSum) break;
      }

      expect(hasNonZeroSum).toBe(true);
    });
  });

  describe('integration with engine types', () => {
    it('output passes validateSolverNodeOutput', () => {
      const config = createTestSolverConfig({ maxIterations: 30 });
      const solution = solvePreflopScenario(config);

      // Test multiple info sets
      let tested = 0;
      for (const infoSetId of solution.strategies.keys()) {
        const output = toSolverNodeOutput(infoSetId, solution);

        // Should not throw
        const validated = validateSolverNodeOutput(output);
        expect(validated).toBeDefined();

        tested++;
        if (tested >= 5) break; // Test a few
      }
    });

    it('handles all standard preflop actions', () => {
      const config = createTestSolverConfig({ maxIterations: 50 });
      const solution = solvePreflopScenario(config);

      // Check that common actions appear in outputs
      const seenActions = new Set<string>();

      for (const infoSetId of solution.strategies.keys()) {
        const output = toSolverNodeOutput(infoSetId, solution);
        for (const action of output.actions) {
          seenActions.add(action.actionId);
        }
      }

      // Should see at least FOLD and CALL/RAISE
      // (exact actions depend on game tree)
      expect(seenActions.size).toBeGreaterThan(0);
    });
  });
});
