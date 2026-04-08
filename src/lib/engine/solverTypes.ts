// src/lib/engine/solverTypes.ts
// Async solver adapter interface and configuration types.
// Used by Phase 2 (preflop) and Phase 3 (postflop WASM) solver integrations.

import type { SolverNodeOutput, SolverRequest } from "./solverAdapter";

/** Bet size configuration for a solver run. */
export interface BetSizeConfig {
  flopBetSizes?: string[];
  turnBetSizes?: string[];
  riverBetSizes?: string[];
  flopRaiseSizes?: string[];
  turnRaiseSizes?: string[];
  riverRaiseSizes?: string[];
}

/** Configuration for a solver run (iterations, target, bet tree). */
export interface SolverConfig {
  maxIterations: number;
  targetExploitability: number;
  betSizes?: BetSizeConfig;
  ranges?: { oop: string; ip: string };
}

/** Progress update during a long-running solve. */
export interface SolverProgress {
  iteration: number;
  exploitability: number;
  elapsedMs: number;
}

/**
 * Async solver adapter interface.
 * Implementations: PreflopRangeAdapter (Phase 2), PostflopSolverAdapter (Phase 3).
 * Fallback: MockSolverAdapter wrapping the existing mock solver.
 */
export interface AsyncSolverAdapter {
  solve(request: SolverRequest): Promise<SolverNodeOutput>;
  solveWithProgress?(
    request: SolverRequest,
    onProgress: (progress: SolverProgress) => void
  ): Promise<SolverNodeOutput>;
}
