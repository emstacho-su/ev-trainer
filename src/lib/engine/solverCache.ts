// src/lib/engine/solverCache.ts
// Two-tier solver cache: IndexedDB (client) + Supabase (server/cross-device).

import type { SolverNodeOutput, SolverRequest } from "./solverAdapter";
import { getFromIndexedDB, setInIndexedDB } from "./solverCacheDb";

/** Cache lookup result with hit/miss metadata. */
export interface CacheLookupResult {
  output: SolverNodeOutput | null;
  source: "indexeddb" | "supabase" | "miss";
}

/**
 * Build a canonical cache key from a solver request.
 * Uses a stable JSON representation of the game state parameters.
 */
export function buildCacheKey(request: SolverRequest): string {
  const { publicState, history } = request;
  const parts = [
    publicState.street,
    publicState.board.slice().sort().join(","),
    publicState.potBb.toFixed(2),
    publicState.effectiveStackBb.toFixed(2),
    history.actions.join(","),
    request.solverConfig?.maxIterations ?? "",
    request.solverConfig?.targetExploitability ?? "",
  ];
  // Simple hash via string — sufficient for cache key uniqueness
  return parts.join("|");
}

/**
 * Look up a solver result from cache.
 * Checks IndexedDB first (fast, local), then Supabase (cross-device).
 */
export async function getCachedResult(
  cacheKey: string
): Promise<CacheLookupResult> {
  // Tier 1: IndexedDB (client-side, fast)
  const localResult = await getFromIndexedDB(cacheKey);
  if (localResult) {
    return { output: localResult, source: "indexeddb" };
  }

  // Tier 2: Supabase (server-side, cross-device)
  if (typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("solver_cache")
        .select("solver_output")
        .eq("canonical_hash", cacheKey)
        .single();

      if (data?.solver_output) {
        const output = data.solver_output as unknown as SolverNodeOutput;
        // Backfill into IndexedDB for future fast lookups
        setInIndexedDB(cacheKey, "", output).catch(() => {});
        return { output, source: "supabase" };
      }
    } catch {
      // Supabase lookup failure is non-critical
    }
  }

  return { output: null, source: "miss" };
}

/**
 * Store a solver result in both cache tiers.
 * IndexedDB write is immediate; Supabase write is fire-and-forget.
 */
export async function cacheResult(
  cacheKey: string,
  request: SolverRequest,
  output: SolverNodeOutput,
  metadata?: { iterations?: number; exploitability?: number }
): Promise<void> {
  const street = request.publicState.street;

  // Tier 1: IndexedDB (always, fast)
  setInIndexedDB(cacheKey, street, output).catch(() => {});

  // Tier 2: Supabase (only if authenticated, fire-and-forget)
  if (typeof window !== "undefined") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.from("solver_cache").upsert(
        {
          canonical_hash: cacheKey,
          street,
          board: request.publicState.board,
          pot_bb: request.publicState.potBb,
          effective_stack_bb: request.publicState.effectiveStackBb,
          solver_output: output as unknown as Record<string, unknown>,
          iterations: metadata?.iterations ?? null,
          exploitability: metadata?.exploitability ?? null,
        },
        { onConflict: "canonical_hash" }
      );
    } catch {
      // Supabase write failure is non-critical
    }
  }
}
