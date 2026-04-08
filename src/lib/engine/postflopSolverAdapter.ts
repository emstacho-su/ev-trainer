// src/lib/engine/postflopSolverAdapter.ts
// Adapter that routes postflop solve requests to either:
// 1. The WASM postflop-solver (when available in browser)
// 2. The existing mock postflop solver (server-side or WASM not loaded)

import type { SolverNodeOutput, SolverRequest } from "./solverAdapter";
import type { AsyncSolverAdapter, SolverProgress } from "./solverTypes";
import type { PostflopSolveConfig } from "./wasm/wasmTypes";
import { DEFAULT_BET_SIZES } from "./wasm/wasmTypes";

/**
 * PostflopSolverAdapter routes to the WASM solver when available,
 * falling back to the mock solver for server-side or when WASM isn't loaded.
 */
export class PostflopSolverAdapter implements AsyncSolverAdapter {
  private wasmAvailable = false;
  private initAttempted = false;

  /**
   * Attempt to initialize WASM solver.
   * Only works client-side. Server-side always falls back to mock.
   */
  private async ensureInit(): Promise<void> {
    if (this.initAttempted) return;
    this.initAttempted = true;

    if (typeof window === "undefined") {
      // Server-side: WASM not available
      return;
    }

    try {
      const bridge = await import("./wasm/solverBridge");
      this.wasmAvailable = await bridge.initSolverBridge();
    } catch {
      // WASM modules not built yet -- use mock fallback
      this.wasmAvailable = false;
    }
  }

  /** Convert a SolverRequest to PostflopSolveConfig for the WASM solver. */
  private toWasmConfig(request: SolverRequest): PostflopSolveConfig {
    const sc = request.solverConfig;
    return {
      oopRange: sc?.ranges?.oop ?? "AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,AK,AQ,AJ,AT",
      ipRange: sc?.ranges?.ip ?? "AA,KK,QQ,JJ,TT,99,88,77,66,55,44,33,22,AK,AQ,AJ,AT",
      board: request.publicState.board,
      startingPot: Math.round(request.publicState.potBb),
      effectiveStack: Math.round(request.publicState.effectiveStackBb),
      maxIterations: sc?.maxIterations ?? 1000,
      targetExploitability: sc?.targetExploitability ?? 0.5,
      betSizes: {
        oopFlopBet: sc?.betSizes?.flopBetSizes?.join(",") ?? DEFAULT_BET_SIZES.oopFlopBet,
        oopFlopRaise: sc?.betSizes?.flopRaiseSizes?.join(",") ?? DEFAULT_BET_SIZES.oopFlopRaise,
        oopTurnBet: sc?.betSizes?.turnBetSizes?.join(",") ?? DEFAULT_BET_SIZES.oopTurnBet,
        oopTurnRaise: sc?.betSizes?.turnRaiseSizes?.join(",") ?? DEFAULT_BET_SIZES.oopTurnRaise,
        oopRiverBet: sc?.betSizes?.riverBetSizes?.join(",") ?? DEFAULT_BET_SIZES.oopRiverBet,
        oopRiverRaise: sc?.betSizes?.riverRaiseSizes?.join(",") ?? DEFAULT_BET_SIZES.oopRiverRaise,
        ipFlopBet: sc?.betSizes?.flopBetSizes?.join(",") ?? DEFAULT_BET_SIZES.ipFlopBet,
        ipFlopRaise: sc?.betSizes?.flopRaiseSizes?.join(",") ?? DEFAULT_BET_SIZES.ipFlopRaise,
        ipTurnBet: sc?.betSizes?.turnBetSizes?.join(",") ?? DEFAULT_BET_SIZES.ipTurnBet,
        ipTurnRaise: sc?.betSizes?.turnRaiseSizes?.join(",") ?? DEFAULT_BET_SIZES.ipTurnRaise,
        ipRiverBet: sc?.betSizes?.riverBetSizes?.join(",") ?? DEFAULT_BET_SIZES.ipRiverBet,
        ipRiverRaise: sc?.betSizes?.riverRaiseSizes?.join(",") ?? DEFAULT_BET_SIZES.ipRiverRaise,
      },
    };
  }

  /**
   * Solve a postflop spot.
   * Uses WASM when available (client-side), mock otherwise.
   */
  async solve(request: SolverRequest): Promise<SolverNodeOutput> {
    await this.ensureInit();

    if (this.wasmAvailable) {
      try {
        const bridge = await import("./wasm/solverBridge");
        const config = this.toWasmConfig(request);
        return await bridge.solvePostflop(config);
      } catch {
        // WASM solve failed -- fall through to mock
      }
    }

    // Fallback: use existing mock postflop solver
    return this.mockSolve(request);
  }

  /**
   * Solve with progress reporting (only available with WASM).
   */
  async solveWithProgress(
    request: SolverRequest,
    onProgress: (progress: SolverProgress) => void
  ): Promise<SolverNodeOutput> {
    await this.ensureInit();

    if (this.wasmAvailable) {
      try {
        const bridge = await import("./wasm/solverBridge");
        const config = this.toWasmConfig(request);
        return await bridge.solvePostflop(config, onProgress);
      } catch {
        // Fall through to mock
      }
    }

    return this.mockSolve(request);
  }

  /**
   * Mock solver fallback using the existing postflop mock.
   * Generates deterministic output matching the session handler's mock.
   */
  private async mockSolve(request: SolverRequest): Promise<SolverNodeOutput> {
    try {
      const { mockSolvePostflop } = await import("../postflop/solver/mockPostflopSolver");
      return mockSolvePostflop({
        street: request.publicState.street as "FLOP" | "TURN" | "RIVER",
        board: request.publicState.board,
        potBb: request.publicState.potBb,
        stackBb: request.publicState.effectiveStackBb,
        heroPosition: "IP",
        heroRange: [],
        villainRange: [],
        heroHand: ["Ah", "Kh"],
        preflopHistory: request.history.actions.join(","),
        villainPosition: "OOP",
        actionAbstraction: { betSizes: [], raiseSizes: [], allInThresholdPot: 1.5, raiseAllInThresholdPot: 1.5 },
        numBuckets: 10,
        maxIterations: 100,
        targetExploitability: 1.0,
        checkConvergenceEvery: 50,
      });
    } catch {
      // If mock solver module not available, return a minimal unsolved response
      return { status: "unsolved", units: "bb", actions: [] };
    }
  }
}
