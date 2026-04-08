// src/lib/engine/wasm/solverBridge.ts
// Main-thread bridge to the WASM solver Web Worker.
// Manages worker lifecycle and provides typed async API via Comlink.

import * as Comlink from "comlink";
import type { SolverWorkerApi } from "./solverWorker";
import type { PostflopSolveConfig } from "./wasmTypes";
import type { SolverNodeOutput } from "../solverAdapter";
import type { SolverProgress } from "../solverTypes";

let worker: Worker | null = null;
let proxy: Comlink.Remote<SolverWorkerApi> | null = null;
let initialized = false;
let initPromise: Promise<boolean> | null = null;

/** Map WASM action names to ev-trainer ActionId format. */
function normalizeActionId(wasmAction: string): string {
  // postflop-solver uses: Fold, Check, Call, Bet X, Raise X, AllIn X
  const lower = wasmAction.toLowerCase();
  if (lower === "fold") return "FOLD";
  if (lower === "check") return "CHECK";
  if (lower === "call") return "CALL";
  if (lower.startsWith("bet")) {
    const amount = wasmAction.replace(/[^0-9.]/g, "");
    return amount ? `BET_${amount}` : "BET";
  }
  if (lower.startsWith("raise")) {
    const amount = wasmAction.replace(/[^0-9.]/g, "");
    return amount ? `RAISE_${amount}` : "RAISE";
  }
  if (lower.startsWith("allin") || lower.startsWith("all")) {
    return "ALL_IN";
  }
  return wasmAction.toUpperCase();
}

/**
 * Initialize the solver Web Worker.
 * Safe to call multiple times -- only initializes once.
 */
export async function initSolverBridge(): Promise<boolean> {
  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof window === "undefined") {
        // Server-side: WASM workers not available
        return false;
      }

      worker = new Worker(
        new URL("./solverWorker.ts", import.meta.url),
        { type: "module" }
      );
      proxy = Comlink.wrap<SolverWorkerApi>(worker);

      const ready = await proxy.init();
      initialized = ready;
      return ready;
    } catch (err) {
      console.error("[SolverBridge] Init failed:", err);
      initialized = false;
      return false;
    }
  })();

  return initPromise;
}

/** Check if the WASM solver is available. */
export function isSolverAvailable(): boolean {
  return initialized;
}

/**
 * Solve a postflop spot using the WASM solver.
 * Returns SolverNodeOutput compatible with the grading pipeline.
 */
export async function solvePostflop(
  config: PostflopSolveConfig,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverNodeOutput> {
  if (!proxy || !initialized) {
    const ready = await initSolverBridge();
    if (!ready || !proxy) {
      return { status: "unsolved", units: "bb", actions: [] };
    }
  }

  try {
    const progressProxy = onProgress
      ? Comlink.proxy((update: SolverProgress) => onProgress(update))
      : undefined;

    const result = await proxy.solve(config, progressProxy);

    // Convert WASM result to SolverNodeOutput
    const actions = result.actions.map((a) => ({
      actionId: normalizeActionId(a.actionId),
      frequency: a.frequency,
      ev: a.ev,
    }));

    return {
      status: "ok",
      units: "bb",
      exploitability: result.exploitability,
      actions,
    };
  } catch (err) {
    console.error("[SolverBridge] Solve failed:", err);
    return { status: "error", units: "bb", actions: [] };
  }
}

/** Terminate the worker and release resources. */
export function disposeSolverBridge(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    proxy = null;
    initialized = false;
    initPromise = null;
  }
}
