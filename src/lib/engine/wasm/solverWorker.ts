// src/lib/engine/wasm/solverWorker.ts
// Web Worker that runs the postflop-solver WASM module.
// Communicates with the main thread via Comlink.
//
// This worker is loaded client-side only. It initializes the WASM module
// and exposes solve/progress functions to the main thread.

import * as Comlink from "comlink";
import type { PostflopSolveConfig } from "./wasmTypes";
import { DEFAULT_BET_SIZES, encodeBoard } from "./wasmTypes";

interface SolveResult {
  actions: Array<{ actionId: string; frequency: number; ev: number }>;
  exploitability: number;
  iterations: number;
  elapsedMs: number;
}

interface ProgressUpdate {
  iteration: number;
  exploitability: number;
  elapsedMs: number;
}

let gameManager: any = null;
let rangeManager: any = null;
let wasmReady = false;

/**
 * Worker API exposed to the main thread via Comlink.
 */
const workerApi = {
  /**
   * Initialize the WASM solver modules.
   * Must call once before solve().
   */
  async init(): Promise<boolean> {
    try {
      // Dynamic import of WASM modules (built by wasm-pack)
      // These paths will resolve after the WASM build pipeline runs.
      // @ts-expect-error -- WASM modules are generated at build time
      const solverModule = await import("../../../../wasm/pkg/solver-st/postflop_solver");
      // @ts-expect-error -- WASM modules are generated at build time
      const rangeModule = await import("../../../../wasm/pkg/range/postflop_solver_range");

      await solverModule.default();
      await rangeModule.default();

      gameManager = new solverModule.GameManager();
      rangeManager = new rangeModule.RangeManager();
      wasmReady = true;
      return true;
    } catch (err) {
      console.error("[SolverWorker] Failed to initialize WASM:", err);
      wasmReady = false;
      return false;
    }
  },

  /** Check if WASM is ready. */
  isReady(): boolean {
    return wasmReady;
  },

  /**
   * Solve a postflop spot and return the strategy at the root node.
   * Reports progress via a callback proxy.
   */
  async solve(
    config: PostflopSolveConfig,
    progressCallback?: (update: ProgressUpdate) => void
  ): Promise<SolveResult> {
    if (!wasmReady || !gameManager || !rangeManager) {
      throw new Error("WASM solver not initialized. Call init() first.");
    }

    const startTime = performance.now();

    // Parse ranges using RangeManager
    const oopRangeManager = new rangeManager.constructor();
    const oopError = oopRangeManager.from_string(config.oopRange);
    if (oopError) throw new Error(`Invalid OOP range: ${oopError}`);

    const ipRangeManager = new rangeManager.constructor();
    const ipError = ipRangeManager.from_string(config.ipRange);
    if (ipError) throw new Error(`Invalid IP range: ${ipError}`);

    const oopRangeData = oopRangeManager.raw_data();
    const ipRangeData = ipRangeManager.raw_data();

    // Encode board
    const board = encodeBoard(config.board);

    // Build bet size strings from config or defaults
    const bs = { ...DEFAULT_BET_SIZES, ...config.betSizes };

    // Initialize game
    const initError = gameManager.init(
      oopRangeData,
      ipRangeData,
      board,
      config.startingPot,
      config.effectiveStack,
      0.0, // rakeRate
      0.0, // rakeCap
      false, // donkOption
      bs.oopFlopBet, bs.oopFlopRaise,
      bs.oopTurnBet, bs.oopTurnRaise,
      "", // oopTurnDonk
      bs.oopRiverBet, bs.oopRiverRaise,
      "", // oopRiverDonk
      bs.ipFlopBet, bs.ipFlopRaise,
      bs.ipTurnBet, bs.ipTurnRaise,
      bs.ipRiverBet, bs.ipRiverRaise,
      1.5, // addAllinThreshold
      0.15, // forceAllinThreshold
      0.1, // mergingThreshold
      "", // addedLines
      "", // removedLines
    );
    if (initError) throw new Error(`Game init failed: ${initError}`);

    // Allocate memory (no compression for accuracy)
    gameManager.allocate_memory(false);

    // Solve iteratively with progress reporting
    let lastExploitability = Infinity;
    const checkEvery = Math.max(1, Math.floor(config.maxIterations / 20));

    for (let i = 0; i < config.maxIterations; i++) {
      gameManager.solve_step(i);

      if (i % checkEvery === 0 || i === config.maxIterations - 1) {
        lastExploitability = gameManager.exploitability();
        const elapsed = performance.now() - startTime;

        if (progressCallback) {
          progressCallback({
            iteration: i + 1,
            exploitability: lastExploitability,
            elapsedMs: elapsed,
          });
        }

        // Early exit if converged
        if (lastExploitability <= config.targetExploitability) {
          break;
        }
      }
    }

    // Finalize strategy
    gameManager.finalize();

    // Extract results at root node
    gameManager.apply_history(new Uint32Array(0));

    const numActions = gameManager.num_actions();
    const results = gameManager.get_results();
    const actionsStr = gameManager.actions_after(new Uint32Array(0), numActions);
    const actionNames = actionsStr.split(",").filter(Boolean);

    // Parse results: strategy array is the first numActions * numCombos values
    // For simplicity, compute average strategy across all combos
    const actions: SolveResult["actions"] = [];
    for (let a = 0; a < actionNames.length; a++) {
      actions.push({
        actionId: actionNames[a],
        frequency: 0,
        ev: 0,
      });
    }

    // The results array packing depends on the WASM module version.
    // This is a simplified extraction -- the real implementation will
    // need to match the exact packing format of get_results().
    // For now, use equal frequencies as placeholder until WASM is available.
    if (actions.length > 0) {
      const equalFreq = 1.0 / actions.length;
      for (const action of actions) {
        action.frequency = equalFreq;
        action.ev = 0;
      }
    }

    const elapsedMs = performance.now() - startTime;

    return {
      actions,
      exploitability: lastExploitability,
      iterations: config.maxIterations,
      elapsedMs,
    };
  },
};

export type SolverWorkerApi = typeof workerApi;

Comlink.expose(workerApi);
