// src/lib/postflop/solver/solverClient.ts
// Async interface for postflop solver. Routes through solverRouter for
// two-tier caching (IndexedDB + Supabase) and WASM solver when available.

import type { PostflopConfig } from '../../solver/postflopTypes';
import type { SolverNodeOutput, SolverRequest } from '../../engine/solverAdapter';
import { routeSolverRequest } from '../../engine/solverRouter';

/** Convert a PostflopConfig into a SolverRequest for the router. */
function toSolverRequest(config: PostflopConfig): SolverRequest {
  return {
    gameVersion: '1.0',
    abstractionVersion: '1.0',
    solverVersion: 'postflop-wasm-v1',
    publicState: {
      street: config.street,
      potBb: config.potBb,
      effectiveStackBb: config.stackBb,
      board: config.board,
      toAct: config.heroPosition === 'OOP' ? 'BB' : 'BTN',
    },
    history: { actions: [] },
    toAct: config.heroPosition === 'OOP' ? 'BB' : 'BTN',
    solverConfig: {
      maxIterations: config.maxIterations,
      targetExploitability: config.targetExploitability,
      ranges: {
        oop: config.heroPosition === 'OOP'
          ? config.heroRange.join(',')
          : config.villainRange.join(','),
        ip: config.heroPosition === 'IP'
          ? config.heroRange.join(',')
          : config.villainRange.join(','),
      },
    },
  };
}

/**
 * Solves a postflop node asynchronously. Routes through solverRouter which:
 * 1. Checks two-tier cache (IndexedDB -> Supabase)
 * 2. Uses WASM solver when available (client-side)
 * 3. Falls back to mock solver (server-side or WASM not loaded)
 */
export async function solvePostflopNode(config: PostflopConfig): Promise<SolverNodeOutput> {
  return routeSolverRequest(toSolverRequest(config));
}
