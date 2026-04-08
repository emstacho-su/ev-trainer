// src/lib/engine/solverRouter.ts
// Routes solver requests by street to the correct adapter.
// Falls back to mock solver for unimplemented streets.

import type { SolverNodeOutput, SolverRequest } from "./solverAdapter";
import { validateSolverNodeOutput } from "./solverAdapter";
import type { AsyncSolverAdapter } from "./solverTypes";
import type { Street } from "./types";
import { mockSolve } from "./mockSolver";
import { canonicalHash } from "./canonicalHash";
import { PreflopRangeAdapter } from "./preflopRangeAdapter";
import { PostflopSolverAdapter } from "./postflopSolverAdapter";

/**
 * Mock adapter wrapping the existing mockSolve function.
 * Used as fallback until real adapters are registered.
 */
class MockSolverAdapter implements AsyncSolverAdapter {
  async solve(request: SolverRequest): Promise<SolverNodeOutput> {
    const hash = canonicalHash({
      street: request.publicState.street,
      board: request.publicState.board,
      potBb: request.publicState.potBb,
      effectiveStackBb: request.publicState.effectiveStackBb,
      history: request.history.actions,
    });
    return mockSolve(hash);
  }
}

/** Registered solver adapters by street. */
const adapters: Partial<Record<Street, AsyncSolverAdapter>> = {};
const fallbackAdapter: AsyncSolverAdapter = new MockSolverAdapter();

// Pre-register adapters by street
const preflopAdapter = new PreflopRangeAdapter();
adapters.PREFLOP = preflopAdapter;

// PostflopSolverAdapter: uses WASM when available (client), mock fallback (server)
const postflopAdapter = new PostflopSolverAdapter();
adapters.FLOP = postflopAdapter;
adapters.TURN = postflopAdapter;
adapters.RIVER = postflopAdapter;

/**
 * Register a solver adapter for a specific street.
 * Call during app initialization (e.g., after WASM loads).
 */
export function registerSolverAdapter(
  street: Street,
  adapter: AsyncSolverAdapter
): void {
  adapters[street] = adapter;
}

/** Get the solver adapter for a street, falling back to mock. */
export function getSolverAdapter(street: Street): AsyncSolverAdapter {
  return adapters[street] ?? fallbackAdapter;
}

/**
 * Route a solver request to the correct adapter and validate the output.
 * This is the primary entry point for solver requests.
 */
export async function routeSolverRequest(
  request: SolverRequest
): Promise<SolverNodeOutput> {
  const adapter = getSolverAdapter(request.publicState.street);
  const output = await adapter.solve(request);
  return validateSolverNodeOutput(output);
}
