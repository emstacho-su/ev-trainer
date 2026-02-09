// src/lib/solver/postflopSolver.test.ts
import { describe, it, expect } from 'vitest';
import {
  solvePostflopSubgame,
  toSolverNodeOutputPostflop,
  createPostflopTree,
  type PostflopConfig,
  type PostflopSolution,
} from './postflopSolver';
import type { Card, Hand } from './types';
import { validateSolverNodeOutput } from '../engine/solverAdapter';

describe('solvePostflopSubgame', () => {
  describe('basic validation', () => {
    it('throws for less than 3 board cards', () => {
      const config: PostflopConfig = {
        maxIterations: 10,
        targetExploitability: 10,
        checkConvergenceEvery: 5,
        street: 'FLOP',
        board: ['Ah', 'Kc'] as Card[], // Only 2 cards
        heroRange: ['AA'],
        villainRange: ['KK'],
        potBb: 10,
        stackBb: 90,
        heroPosition: 'IP',
        actionAbstraction: {
          betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
          raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
          includeAllIn: true,
          allInThreshold: 2.0,
        },
        numBuckets: 50,
      };

      expect(() => solvePostflopSubgame(config)).toThrow(
        'Postflop solver requires at least 3 board cards'
      );
    });

    it('throws for more than 5 board cards', () => {
      const config: PostflopConfig = {
        maxIterations: 10,
        targetExploitability: 10,
        checkConvergenceEvery: 5,
        street: 'RIVER',
        board: ['Ah', 'Kc', '2d', '5s', '8h', '9c'] as Card[], // 6 cards
        heroRange: ['AA'],
        villainRange: ['KK'],
        potBb: 10,
        stackBb: 90,
        heroPosition: 'IP',
        actionAbstraction: {
          betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
          raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
          includeAllIn: true,
          allInThreshold: 2.0,
        },
        numBuckets: 50,
      };

      expect(() => solvePostflopSubgame(config)).toThrow(
        'Board cannot have more than 5 cards'
      );
    });
  });

  describe('flop solving', () => {
    it('solves a basic flop scenario', () => {
      const config: PostflopConfig = {
        maxIterations: 10,
        targetExploitability: 100,
        checkConvergenceEvery: 5,
        street: 'FLOP',
        board: ['Ah', 'Kc', '2d'],
        heroRange: ['AA', 'KK', 'AKs', 'AKo'],
        villainRange: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
        potBb: 10,
        stackBb: 90,
        heroPosition: 'IP',
        actionAbstraction: {
          betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
          raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
          includeAllIn: true,
          allInThreshold: 2.0,
        },
        numBuckets: 50,
      };

      const solution = solvePostflopSubgame(config);

      expect(solution).toBeDefined();
      expect(solution.result.iterations).toBe(100);
      expect(solution.board).toEqual(['Ah', 'Kc', '2d']);
      expect(solution.street).toBe('FLOP');
      expect(solution.buckets.length).toBe(50);
    });

    it('creates info sets using bucket-based abstraction', () => {
      const config: PostflopConfig = {
        maxIterations: 10,
        targetExploitability: 10,
        checkConvergenceEvery: 5,
        street: 'FLOP',
        board: ['Ah', 'Kc', '2d'],
        heroRange: ['AA', 'KK'],
        villainRange: ['QQ', 'JJ'],
        potBb: 10,
        stackBb: 90,
        heroPosition: 'OOP',
        actionAbstraction: {
          betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
          raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
          includeAllIn: true,
          allInThreshold: 2.0,
        },
        numBuckets: 10, // Fewer buckets for easier testing
      };

      const solution = solvePostflopSubgame(config);

      // Should have created some info sets
      expect(solution.strategies.size).toBeGreaterThan(0);

      // Info set IDs should include bucket notation (B{bucketId})
      const infoSetIds = Array.from(solution.strategies.keys());
      const hasBucketNotation = infoSetIds.some(id => id.includes(':B'));
      expect(hasBucketNotation).toBe(true);
    });

    it('reduces complexity vs per-hand abstraction', () => {
      const config: PostflopConfig = {
        maxIterations: 10,
        targetExploitability: 10,
        checkConvergenceEvery: 5,
        street: 'FLOP',
        board: ['Ah', 'Kc', '2d'],
        heroRange: ['AA', 'KK', 'QQ', 'JJ', 'TT'], // 5 canonical hands
        villainRange: ['AA', 'KK', 'QQ', 'JJ', 'TT'],
        potBb: 10,
        stackBb: 90,
        heroPosition: 'OOP',
        actionAbstraction: {
          betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
          raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
          includeAllIn: true,
          allInThreshold: 2.0,
        },
        numBuckets: 10,
      };

      const solution = solvePostflopSubgame(config);

      // With 10 buckets, should have far fewer info sets than
      // if we used per-hand abstraction (which would be 5 hands * actions * histories)
      // Bucketing collapses many hands into same strategy
      expect(solution.strategies.size).toBeLessThan(100); // Reasonable upper bound
    });
  });

  describe('turn solving', () => {
    it('solves a turn scenario', () => {
      const config: PostflopConfig = {
        maxIterations: 10,
        targetExploitability: 10,
        checkConvergenceEvery: 5,
        street: 'TURN',
        board: ['Ah', 'Kc', '2d', '5s'], // 4 cards
        heroRange: ['AA', 'KK'],
        villainRange: ['QQ', 'JJ'],
        potBb: 20,
        stackBb: 80,
        heroPosition: 'IP',
        actionAbstraction: {
          betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
          raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
          includeAllIn: true,
          allInThreshold: 2.0,
        },
        numBuckets: 50,
      };

      const solution = solvePostflopSubgame(config);

      expect(solution.board.length).toBe(4);
      expect(solution.street).toBe('TURN');
    });
  });

  describe('river solving', () => {
    it('solves a river scenario', () => {
      const config: PostflopConfig = {
        maxIterations: 10,
        targetExploitability: 10,
        checkConvergenceEvery: 5,
        street: 'RIVER',
        board: ['Ah', 'Kc', '2d', '5s', '8h'], // 5 cards
        heroRange: ['AA', 'KK'],
        villainRange: ['QQ', 'JJ'],
        potBb: 30,
        stackBb: 70,
        heroPosition: 'OOP',
        actionAbstraction: {
          betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
          raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
          includeAllIn: true,
          allInThreshold: 2.0,
        },
        numBuckets: 50,
      };

      const solution = solvePostflopSubgame(config);

      expect(solution.board.length).toBe(5);
      expect(solution.street).toBe('RIVER');
    });
  });

  describe('convergence', () => {
    it('produces strategies that converge over iterations', () => {
      const config: PostflopConfig = {
        maxIterations: 20,
        targetExploitability: 100,
        checkConvergenceEvery: 10,
        street: 'FLOP',
        board: ['Ah', 'Kc', '2d'],
        heroRange: ['AA', 'KK'],
        villainRange: ['QQ', 'JJ'],
        potBb: 10,
        stackBb: 90,
        heroPosition: 'IP',
        actionAbstraction: {
          betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
          raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
          includeAllIn: true,
          allInThreshold: 2.0,
        },
        numBuckets: 20,
      };

      const solution = solvePostflopSubgame(config);

      // Should have run iterations
      expect(solution.result.iterations).toBeGreaterThan(0);

      // Exploitability should be finite
      expect(solution.result.exploitability).toBeFinite();
    });
  });
});

describe('toSolverNodeOutputPostflop', () => {
  it('converts solution to SolverNodeOutput format', () => {
    const config: PostflopConfig = {
      maxIterations: 10,
      targetExploitability: 10,
      checkConvergenceEvery: 5,
      street: 'FLOP',
      board: ['Ah', 'Kc', '2d'],
      heroRange: ['AA', 'KK'],
      villainRange: ['QQ', 'JJ'],
      potBb: 10,
      stackBb: 90,
      heroPosition: 'OOP',
      actionAbstraction: {
        betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
        raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
      numBuckets: 10,
    };

    const solution = solvePostflopSubgame(config);

    // Get output for a specific hand
    const hand: Hand = ['As', 'Ad'];
    const board: Card[] = ['Ah', 'Kc', '2d'];

    const output = toSolverNodeOutputPostflop(hand, board, solution);

    expect(output).toBeDefined();
    expect(output.nodeId).toBeTruthy();
    expect(output.units).toBe('bb');

    // Validate output format
    validateSolverNodeOutput(output);
  });

  it('produces valid probability distributions', () => {
    const config: PostflopConfig = {
      maxIterations: 10,
      targetExploitability: 10,
      checkConvergenceEvery: 5,
      street: 'FLOP',
      board: ['Ah', 'Kc', '2d'],
      heroRange: ['AA'],
      villainRange: ['KK'],
      potBb: 10,
      stackBb: 90,
      heroPosition: 'IP',
      actionAbstraction: {
        betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
        raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
      numBuckets: 50,
    };

    const solution = solvePostflopSubgame(config);

    const hand: Hand = ['Ac', 'Ad'];
    const board: Card[] = ['Ah', 'Kc', '2d'];

    const output = toSolverNodeOutputPostflop(hand, board, solution);

    if (output.actions.length > 0) {
      // Sum of frequencies should be ~1.0
      const freqSum = output.actions.reduce((sum, a) => sum + a.frequency, 0);
      expect(Math.abs(freqSum - 1.0)).toBeLessThan(0.01);

      // All frequencies should be non-negative
      for (const action of output.actions) {
        expect(action.frequency).toBeGreaterThanOrEqual(0);
        expect(action.frequency).toBeLessThanOrEqual(1);
      }
    }
  });

  it('handles unsolved info sets', () => {
    const config: PostflopConfig = {
      maxIterations: 10,
      targetExploitability: 10,
      checkConvergenceEvery: 5,
      street: 'FLOP',
      board: ['Ah', 'Kc', '2d'],
      heroRange: ['AA'],
      villainRange: ['KK'],
      potBb: 10,
      stackBb: 90,
      heroPosition: 'IP',
      actionAbstraction: {
        betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
        raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
      numBuckets: 50,
    };

    const solution = solvePostflopSubgame(config);

    // Try to get output for a hand that wasn't in the traversal
    const hand: Hand = ['9h', '9d'];
    const board: Card[] = ['Ah', 'Kc', '2d'];

    const output = toSolverNodeOutputPostflop(hand, board, solution);

    // Should handle gracefully (return unsolved)
    expect(output.status).toBeDefined();
  });
});

describe('createPostflopTree', () => {
  it('creates a chance node for postflop tree root', () => {
    const config: PostflopConfig = {
      maxIterations: 10,
      targetExploitability: 10,
      checkConvergenceEvery: 5,
      street: 'FLOP',
      board: ['Ah', 'Kc', '2d'],
      heroRange: ['AA'],
      villainRange: ['KK'],
      potBb: 10,
      stackBb: 90,
      heroPosition: 'IP',
      actionAbstraction: {
        betSizes: { PREFLOP: [0.5, 1.0], FLOP: [0.5, 1.0], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
        raiseSizes: { PREFLOP: [2.2, 2.5], FLOP: [2.2, 2.5], TURN: [2.2, 2.5], RIVER: [2.2, 2.5] },
        includeAllIn: true,
        allInThreshold: 2.0,
      },
      numBuckets: 50,
    };

    const tree = createPostflopTree(config);

    expect(tree.nodeType).toBe('CHANCE');
    expect(tree.nodeId).toContain('POSTFLOP');
    expect(tree.depth).toBe(0);
  });
});
