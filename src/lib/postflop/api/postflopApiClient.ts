// src/lib/postflop/api/postflopApiClient.ts
// Client-side wrapper for postflop solver. Currently calls mock solver directly;
// swap to real API call in production.

import type { SolverNodeOutput } from '../../engine/solverAdapter';
import type { PostflopConfig } from '../../solver/postflopTypes';
import { solvePostflopNode } from '../solver/solverClient';

/**
 * Fetch a postflop solution for the given config.
 * Currently calls solvePostflopNode directly (client-side mock).
 * Future: replace with fetch('/api/postflop/solve', ...) for server-side solving.
 */
export async function fetchPostflopSolution(
  config: PostflopConfig,
): Promise<SolverNodeOutput> {
  try {
    return await solvePostflopNode(config);
  } catch {
    return { actions: [], status: 'error', units: 'bb' };
  }
}
