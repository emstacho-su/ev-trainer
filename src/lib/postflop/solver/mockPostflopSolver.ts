// src/lib/postflop/solver/mockPostflopSolver.ts
// Mock postflop solver for development. Returns deterministic SolverNodeOutput
// based on board hash without running full CFR+ iterations.

import type { SolverNodeOutput, SolverActionOutput } from '../../engine/solverAdapter';
import type { PostflopConfig } from '../../solver/postflopSolver';
import { POSTFLOP_ACTIONS } from '../../solver/postflopSolver';

/**
 * Simple djb2 hash function for deterministic output from a string key.
 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Deterministic pseudo-random number from seed in [0, 1).
 * Advances the seed each call via simple LCG.
 */
function seededRandom(seed: number): { value: number; next: number } {
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return { value: next / 0x100000000, next };
}

/**
 * Available action sets depending on whether hero faces a bet.
 * For mock purposes we select a subset based on the hash.
 */
const ACTION_SETS: string[][] = [
  [POSTFLOP_ACTIONS.CHECK, POSTFLOP_ACTIONS.BET_75],
  [POSTFLOP_ACTIONS.CHECK, POSTFLOP_ACTIONS.BET_33, POSTFLOP_ACTIONS.BET_75],
  [POSTFLOP_ACTIONS.FOLD, POSTFLOP_ACTIONS.CALL, POSTFLOP_ACTIONS.RAISE_2_2],
  [POSTFLOP_ACTIONS.FOLD, POSTFLOP_ACTIONS.CALL],
  [POSTFLOP_ACTIONS.CHECK, POSTFLOP_ACTIONS.BET_50, POSTFLOP_ACTIONS.BET_100, POSTFLOP_ACTIONS.ALL_IN],
];

/**
 * Mock postflop solver. Returns deterministic SolverNodeOutput based on
 * board cards, street, pot, and stack. Follows the pattern in mockSolver.ts.
 *
 * @param config - Postflop solver configuration
 * @returns SolverNodeOutput with 2-4 actions, frequencies summing to 1.0
 */
export function mockSolvePostflop(config: PostflopConfig): SolverNodeOutput {
  // Build a deterministic key from config
  const key = `${config.street}:${config.board.join('')}:${config.potBb}:${config.stackBb}:${config.heroPosition}`;
  let seed = djb2(key);

  // Select action set (2-4 actions)
  const setIndex = seed % ACTION_SETS.length;
  const actionIds = ACTION_SETS[setIndex];

  // Generate raw frequencies
  const rawFreqs: number[] = [];
  for (let i = 0; i < actionIds.length; i++) {
    const rng = seededRandom(seed);
    seed = rng.next;
    rawFreqs.push(0.1 + rng.value * 0.9); // range [0.1, 1.0) to avoid near-zero
  }

  // Normalize to sum to 1.0
  const freqSum = rawFreqs.reduce((a, b) => a + b, 0);
  const frequencies = rawFreqs.map((f) => f / freqSum);

  // Generate EV values in range [-5.0, +5.0] bb
  const actions: SolverActionOutput[] = actionIds.map((actionId, i) => {
    const rng = seededRandom(seed);
    seed = rng.next;
    const ev = rng.value * 10.0 - 5.0; // [-5.0, +5.0]
    return {
      actionId,
      frequency: frequencies[i],
      ev: Math.round(ev * 100) / 100, // 2 decimal places
    };
  });

  // Build a stable nodeId from the key
  const nodeId = `mock:postflop:${(djb2(key + ':node') >>> 0).toString(16).slice(0, 12)}`;

  return {
    nodeId,
    actions,
    status: 'ok',
    units: 'bb',
  };
}
