// src/__tests__/postflopTrainingFlow.test.ts
// Integration test for Phase 5: Postflop Training Mode.
// Covers all 6 success criteria with mock WASM adapter.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  postflopReducer,
  initialPostflopState,
  type PostflopSessionState,
} from '../lib/postflop/session/postflopReducer';
import { solvePostflopNode } from '../lib/postflop/solver/solverClient';
import { mockSolvePostflop } from '../lib/postflop/solver/mockPostflopSolver';
import { generatePostflopHand } from '../lib/postflop/utils/handGenerator';
import { sampleVillainAction } from '../lib/postflop/utils/villainSampler';
import type { SolverNodeOutput } from '../lib/engine/solverAdapter';
import type { PostflopConfig } from '../lib/solver/postflopTypes';
import type { Card } from '../lib/solver/types';

// ── Helpers ───────────────────────────────────────────────────────────

function makeSolverOutput(
  actions: { actionId: string; frequency: number; ev: number }[],
): SolverNodeOutput {
  return { actions, status: 'ok', units: 'bb' };
}

function buildConfig(
  street: 'FLOP' | 'TURN' | 'RIVER',
  board: Card[],
  potBb: number,
  stackBb: number,
): PostflopConfig {
  return {
    maxIterations: 100,
    targetExploitability: 0.5,
    checkConvergenceEvery: 10,
    street,
    board,
    heroRange: [],
    villainRange: [],
    potBb,
    stackBb,
    heroPosition: 'IP',
    actionAbstraction: {
      betSizes: { PREFLOP: [], FLOP: [0.33, 0.75], TURN: [0.5, 1.0], RIVER: [0.5, 1.0] },
      raiseSizes: { PREFLOP: [], FLOP: [2.2], TURN: [2.5], RIVER: [3.0] },
      includeAllIn: true,
      allInThreshold: 2.0,
    },
  };
}

const heroHand: [Card, Card] = ['Ah', 'Kh'];
const flopBoard: Card[] = ['Qd', 'Js', '2c'];
const turnBoard: Card[] = ['Qd', 'Js', '2c', '7h'];
const riverBoard: Card[] = ['Qd', 'Js', '2c', '7h', '3s'];

// ── SC1: Flop decision with dynamic bet sizing from solver ───────────

describe('SC1: Flop decision with dynamic bet sizing', () => {
  it('solver returns actions with dynamic bet sizes based on pot/stack', () => {
    const config = buildConfig('FLOP', flopBoard, 6, 97);
    const output = mockSolvePostflop(config);

    expect(output.status).toBe('ok');
    expect(output.actions.length).toBeGreaterThanOrEqual(2);
    // Each action has frequency and ev
    for (const action of output.actions) {
      expect(typeof action.actionId).toBe('string');
      expect(action.frequency).toBeGreaterThan(0);
      expect(typeof action.ev).toBe('number');
      expect(Number.isFinite(action.ev)).toBe(true);
    }
    // Frequencies sum to ~1.0
    const freqSum = output.actions.reduce((sum, a) => sum + a.frequency, 0);
    expect(freqSum).toBeCloseTo(1.0, 2);
  });

  it('different pot sizes produce different solver outputs', () => {
    const small = mockSolvePostflop(buildConfig('FLOP', flopBoard, 6, 97));
    const large = mockSolvePostflop(buildConfig('FLOP', flopBoard, 40, 97));

    // Same board but different pot → different output due to hash-based determinism
    const smallKey = small.actions.map((a) => a.actionId).join(',');
    const largeKey = large.actions.map((a) => a.actionId).join(',');
    // At minimum both should be valid outputs
    expect(small.actions.length).toBeGreaterThanOrEqual(2);
    expect(large.actions.length).toBeGreaterThanOrEqual(2);
    // Different pot sizes should produce different deterministic outputs
    // (or at minimum, different frequencies/EVs)
    const smallFreqs = small.actions.map((a) => a.frequency);
    const largeFreqs = large.actions.map((a) => a.frequency);
    expect(smallFreqs).not.toEqual(largeFreqs);
  });
});

// ── SC2: Multi-street progression FLOP → TURN → RIVER ───────────────

describe('SC2: Multi-street progression', () => {
  it('progresses through all three streets to summary', () => {
    let state: PostflopSessionState = postflopReducer(initialPostflopState, {
      type: 'START_HAND',
      payload: { heroHand, board: flopBoard, potBb: 6, stackBb: 97, heroPosition: 'IP' },
    });

    expect(state.machineState).toBe('deciding');
    expect(state.currentStreet).toBe('FLOP');

    // -- Flop --
    const flopOutput = makeSolverOutput([
      { actionId: 'CHECK', frequency: 0.6, ev: 1.2 },
      { actionId: 'BET_75', frequency: 0.4, ev: 2.1 },
    ]);
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'CHECK' } });
    expect(state.machineState).toBe('evaluating');
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: flopOutput } });
    expect(state.machineState).toBe('advancing');
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: turnBoard } });
    expect(state.machineState).toBe('deciding');
    expect(state.currentStreet).toBe('TURN');

    // -- Turn --
    const turnOutput = makeSolverOutput([
      { actionId: 'BET_50', frequency: 0.7, ev: 3.0 },
      { actionId: 'CHECK', frequency: 0.3, ev: 1.0 },
    ]);
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'BET_50' } });
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: turnOutput } });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });
    expect(state.machineState).toBe('deciding');
    expect(state.currentStreet).toBe('RIVER');

    // -- River --
    const riverOutput = makeSolverOutput([
      { actionId: 'CHECK', frequency: 0.5, ev: 4.0 },
      { actionId: 'BET_100', frequency: 0.5, ev: 4.5 },
    ]);
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'CHECK' } });
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: riverOutput } });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });

    expect(state.machineState).toBe('summary');
    expect(state.decisions.FLOP).toBeDefined();
    expect(state.decisions.TURN).toBeDefined();
    expect(state.decisions.RIVER).toBeDefined();
  });
});

// ── SC3: Off-solver-line deviation tracking ──────────────────────────

describe('SC3: Off-solver-line deviation tracking', () => {
  it('tracks deviation when user action is not in solver strategy', () => {
    let state = postflopReducer(initialPostflopState, {
      type: 'START_HAND',
      payload: { heroHand, board: flopBoard, potBb: 6, stackBb: 97, heroPosition: 'IP' },
    });

    // User picks 'RAISE' which solver doesn't recommend
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'RAISE' } });
    const output = makeSolverOutput([
      { actionId: 'CHECK', frequency: 0.6, ev: 1.2 },
      { actionId: 'BET_75', frequency: 0.4, ev: 2.1 },
    ]);
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output } });

    expect(state.deviatedStreet).toBe('FLOP');
    expect(state.decisions.FLOP!.isOnSolverLine).toBe(false);
  });

  it('deviation persists through subsequent streets', () => {
    let state = postflopReducer(initialPostflopState, {
      type: 'START_HAND',
      payload: { heroHand, board: flopBoard, potBb: 6, stackBb: 97, heroPosition: 'IP' },
    });

    // Flop: deviate
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'RAISE' } });
    state = postflopReducer(state, {
      type: 'SOLVER_OUTPUT',
      payload: { output: makeSolverOutput([{ actionId: 'CHECK', frequency: 1, ev: 1 }]) },
    });
    expect(state.deviatedStreet).toBe('FLOP');

    // Turn: even matching action, deviation persists
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: turnBoard } });
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'BET_50' } });
    state = postflopReducer(state, {
      type: 'SOLVER_OUTPUT',
      payload: { output: makeSolverOutput([{ actionId: 'BET_50', frequency: 0.8, ev: 3 }]) },
    });
    expect(state.deviatedStreet).toBe('FLOP');

    // River
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'CHECK' } });
    state = postflopReducer(state, {
      type: 'SOLVER_OUTPUT',
      payload: { output: makeSolverOutput([{ actionId: 'CHECK', frequency: 1, ev: 4 }]) },
    });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });

    expect(state.machineState).toBe('summary');
    expect(state.summary!.deviatedStreet).toBe('FLOP');
  });
});

// ── SC4: Spot context labels ─────────────────────────────────────────

describe('SC4: Spot context labels', () => {
  it('hand generator produces valid spot metadata', () => {
    const spot = generatePostflopHand();
    expect(spot.heroPosition).toMatch(/^(IP|OOP)$/);
    expect(spot.board.length).toBe(5);
    expect(spot.heroHand.length).toBe(2);
    expect(spot.potBb).toBeGreaterThan(0);
    expect(spot.stackBb).toBeGreaterThan(0);
  });

  it('generates different hands on multiple calls', () => {
    const hands = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const spot = generatePostflopHand();
      hands.add(spot.board.join(','));
    }
    // Should have at least 2 unique boards in 10 attempts
    expect(hands.size).toBeGreaterThanOrEqual(2);
  });
});

// ── SC5: Villain action sampling ─────────────────────────────────────

describe('SC5: Villain action sampling', () => {
  it('samples a valid action from solver output', () => {
    const output = makeSolverOutput([
      { actionId: 'CHECK', frequency: 0.6, ev: 1.2 },
      { actionId: 'BET_75', frequency: 0.4, ev: 2.1 },
    ]);
    const validActions = output.actions.map((a) => a.actionId);

    // Sample 20 times — all results should be from the available actions
    for (let i = 0; i < 20; i++) {
      const sampled = sampleVillainAction(output);
      expect(validActions).toContain(sampled);
    }
  });

  it('falls back to CHECK when no actions available', () => {
    const output = makeSolverOutput([]);
    const result = sampleVillainAction(output);
    expect(result).toBe('CHECK');
  });
});

// ── SC6: Hand summary after hand completes ───────────────────────────

describe('SC6: Hand summary modal data', () => {
  it('summary contains all street decisions with grades', () => {
    let state = postflopReducer(initialPostflopState, {
      type: 'START_HAND',
      payload: { heroHand, board: flopBoard, potBb: 10, stackBb: 100, heroPosition: 'OOP' },
    });

    // Flop: on line
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'CHECK' } });
    state = postflopReducer(state, {
      type: 'SOLVER_OUTPUT',
      payload: {
        output: makeSolverOutput([
          { actionId: 'CHECK', frequency: 0.7, ev: 1.0 },
          { actionId: 'BET_33', frequency: 0.3, ev: 0.5 },
        ]),
      },
    });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: turnBoard } });

    // Turn: on line
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'BET_50' } });
    state = postflopReducer(state, {
      type: 'SOLVER_OUTPUT',
      payload: {
        output: makeSolverOutput([
          { actionId: 'BET_50', frequency: 0.6, ev: 2.0 },
          { actionId: 'CHECK', frequency: 0.4, ev: 1.5 },
        ]),
      },
    });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });

    // River: off line
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'ALL_IN' } });
    state = postflopReducer(state, {
      type: 'SOLVER_OUTPUT',
      payload: {
        output: makeSolverOutput([
          { actionId: 'CHECK', frequency: 0.5, ev: 3.0 },
          { actionId: 'BET_75', frequency: 0.5, ev: 3.5 },
        ]),
      },
    });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });

    // Verify summary
    expect(state.machineState).toBe('summary');
    const summary = state.summary!;

    // Spot info
    expect(summary.spot.heroHand).toEqual(heroHand);
    expect(summary.spot.potBb).toBe(10);
    expect(summary.spot.heroPosition).toBe('OOP');

    // Per-street decisions
    expect(summary.decisions.FLOP).toBeDefined();
    expect(summary.decisions.FLOP!.isOnSolverLine).toBe(true);
    expect(summary.decisions.FLOP!.solverOutput!.actions.length).toBeGreaterThan(0);

    expect(summary.decisions.TURN).toBeDefined();
    expect(summary.decisions.TURN!.isOnSolverLine).toBe(true);

    expect(summary.decisions.RIVER).toBeDefined();
    expect(summary.decisions.RIVER!.isOnSolverLine).toBe(false);

    // Deviation tracked
    expect(summary.deviatedStreet).toBe('RIVER');

    // Completion timestamp
    expect(summary.completedAt).toBeDefined();
    expect(new Date(summary.completedAt).getTime()).toBeGreaterThan(0);
  });

  it('summary with no deviations has null deviatedStreet', () => {
    let state = postflopReducer(initialPostflopState, {
      type: 'START_HAND',
      payload: { heroHand, board: flopBoard, potBb: 6, stackBb: 97, heroPosition: 'IP' },
    });

    // All three streets on line
    for (const [board, actionId] of [
      [turnBoard, 'CHECK'],
      [riverBoard, 'BET_50'],
      [riverBoard, 'CHECK'],
    ] as [Card[], string][]) {
      state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId } });
      state = postflopReducer(state, {
        type: 'SOLVER_OUTPUT',
        payload: { output: makeSolverOutput([{ actionId, frequency: 0.8, ev: 2 }]) },
      });
      state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: board } });
    }

    expect(state.machineState).toBe('summary');
    expect(state.summary!.deviatedStreet).toBeNull();
  });
});

// ── Solver routing integration ───────────────────────────────────────

describe('Solver routing: solvePostflopNode routes through solverRouter', () => {
  it('returns valid SolverNodeOutput for a flop config', async () => {
    const config = buildConfig('FLOP', flopBoard, 6, 97);
    const output = await solvePostflopNode(config);

    expect(output.status).toMatch(/^(ok|unsolved)$/);
    expect(output.units).toBe('bb');
    expect(Array.isArray(output.actions)).toBe(true);
    if (output.status === 'ok') {
      expect(output.actions.length).toBeGreaterThan(0);
      for (const action of output.actions) {
        expect(typeof action.actionId).toBe('string');
        expect(Number.isFinite(action.frequency)).toBe(true);
        expect(Number.isFinite(action.ev)).toBe(true);
      }
    }
  });

  it('returns valid output for turn and river configs', async () => {
    for (const [street, board] of [
      ['TURN', turnBoard],
      ['RIVER', riverBoard],
    ] as const) {
      const config = buildConfig(street, board as Card[], 12, 91);
      const output = await solvePostflopNode(config);
      expect(output.status).toMatch(/^(ok|unsolved)$/);
      expect(output.units).toBe('bb');
    }
  });
});
