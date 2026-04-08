// src/lib/engine/solverRouter.ts
// Routes solver requests by street to the correct adapter.
// Falls back to mock solver for unimplemented streets.

import type { SolverNodeOutput, SolverRequest } from "./solverAdapter";
import { validateSolverNodeOutput } from "./solverAdapter";
import type { AsyncSolverAdapter } from "./solverTypes";
import type { Street } from "./types";
import { mockSolve } from "./mockSolver";
import { PreflopRangeAdapter } from "./preflopRangeAdapter";
import { PostflopSolverAdapter } from "./postflopSolverAdapter";
import { buildCacheKey, getCachedResult, cacheResult } from "./solverCache";

/**
 * Mock adapter wrapping the existing mockSolve function.
 * Used as fallback until real adapters are registered.
 */
class MockSolverAdapter implements AsyncSolverAdapter {
  async solve(request: SolverRequest): Promise<SolverNodeOutput> {
    const hash = buildCacheKey(request);
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
 * Checks two-tier cache before solving; stores result after solve.
 * This is the primary entry point for solver requests.
 */
export async function routeSolverRequest(
  request: SolverRequest
): Promise<SolverNodeOutput> {
  const cacheKey = buildCacheKey(request);

  // Check cache first (IndexedDB -> Supabase)
  const cached = await getCachedResult(cacheKey);
  if (cached.output) {
    console.debug(`[solver-cache] HIT (${cached.source}): ${cacheKey.slice(0, 40)}...`);
    return validateSolverNodeOutput(cached.output);
  }

  console.debug(`[solver-cache] MISS: ${cacheKey.slice(0, 40)}...`);

  // Solve via adapter
  const adapter = getSolverAdapter(request.publicState.street);
  const output = await adapter.solve(request);
  const validated = validateSolverNodeOutput(output);

  // Store in cache (fire-and-forget)
  cacheResult(cacheKey, request, validated, {
    exploitability: validated.exploitability,
  }).catch(() => {});

  return validated;
}
