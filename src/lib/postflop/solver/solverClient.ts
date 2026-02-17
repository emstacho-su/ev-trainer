// src/lib/postflop/solver/solverClient.ts
// Async interface for postflop solver. The UI calls this module to get
// solver output for a given board/street configuration.

// TODO: Replace with Web Worker + real CFR+ solver for production

import type { PostflopConfig } from '../../solver/postflopSolver';
import type { SolverNodeOutput } from '../../engine/solverAdapter';
import { mockSolvePostflop } from './mockPostflopSolver';

/**
 * Small delay to simulate async solver work and test loading states.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Solves a postflop node asynchronously. Currently backed by the mock solver
 * with a small artificial delay to simulate real solver latency.
 *
 * @param config - Postflop solver configuration
 * @returns Promise resolving to SolverNodeOutput
 */
export async function solvePostflopNode(config: PostflopConfig): Promise<SolverNodeOutput> {
  // 50ms artificial delay to simulate async solver and test loading states
  await delay(50);

  return mockSolvePostflop(config);
}
