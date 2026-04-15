// src/lib/engine/postflopSolverAdapter.test.ts
// Integration-ish test for the routing + telemetry behavior. We can't exercise
// the real WASM path in a Node unit test (no Web Worker), but we can verify
// that the adapter records the correct telemetry event when it falls back.

import { describe, it, expect, beforeEach } from "vitest";
import { PostflopSolverAdapter } from "./postflopSolverAdapter";
import {
  getSolverHistory,
  resetSolverTelemetry,
} from "./solverTelemetry";
import type { SolverRequest } from "./solverAdapter";

function makeRequest(street: "FLOP" | "TURN" | "RIVER" = "FLOP"): SolverRequest {
  return {
    publicState: {
      street,
      board: ["Ah", "Kd", "7c"],
      potBb: 10,
      effectiveStackBb: 95,
      positions: ["BB", "BTN"],
      stacksBb: { BB: 95, BTN: 95 },
      bets: {},
      heroPosition: "BB",
    },
    history: { actions: [] },
    heroHand: ["As", "Kh"],
    solverConfig: {
      maxIterations: 100,
      targetExploitability: 2.0,
    },
  } as unknown as SolverRequest;
}

describe("PostflopSolverAdapter — routing + telemetry", () => {
  beforeEach(() => {
    resetSolverTelemetry();
  });

  it("records mock-fallback-unavailable when running server-side", async () => {
    // In the node test environment, window is undefined -> wasm not available.
    const adapter = new PostflopSolverAdapter();
    const result = await adapter.solve(makeRequest("FLOP"));

    const history = getSolverHistory();
    const event = history[history.length - 1];

    expect(event.path).toBe("mock-fallback-unavailable");
    expect(event.street).toBe("FLOP");
    // Mock fallback still returns a valid output shape
    expect(result).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
  });

  it("reports the correct street in the event", async () => {
    const adapter = new PostflopSolverAdapter();
    await adapter.solve(makeRequest("TURN"));
    const event = getSolverHistory().pop();
    expect(event?.street).toBe("TURN");
  });

  it("solveWithProgress also records telemetry", async () => {
    const adapter = new PostflopSolverAdapter();
    await adapter.solveWithProgress(makeRequest("RIVER"), () => {});
    const event = getSolverHistory().pop();
    expect(event?.path).toBe("mock-fallback-unavailable");
    expect(event?.street).toBe("RIVER");
  });
});
