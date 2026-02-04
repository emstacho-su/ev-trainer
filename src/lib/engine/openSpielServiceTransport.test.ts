import { describe, expect, it } from "vitest";
import { createOpenSpielServiceTransport } from "./openSpielServiceTransport";
import type { SolverNodeRequestV2 } from "./solverAdapter";

const request: SolverNodeRequestV2 = {
  provider: "openspiel",
  nodeHash: "node-hash-1",
  context: {
    gameVersion: "HU-NLHE",
    abstractionVersion: "v1",
    solverVersion: "openspiel:1.0.0",
    evUnit: "bb_per_hand",
  },
  state: {
    street: "flop",
    board: ["Ah", "7d", "2c"],
    potBb: 4.5,
    effectiveStackBb: 100,
    heroPosition: "BTN",
    villainPosition: "BB",
    toAct: "hero",
  },
  actionHistory: [{ actor: "hero", action: "check" }],
};

describe("openSpielServiceTransport", () => {
  it("returns parsed solver response from bridge output", () => {
    const transport = createOpenSpielServiceTransport({
      command: "python",
      args: ["bridge.py"],
      runner: (_command, _args, options) => {
        const payload = JSON.parse(options.input) as { request: SolverNodeRequestV2 };
        return JSON.stringify({
          provider: "openspiel",
          nodeHash: payload.request.nodeHash,
          actions: [{ actionId: "CHECK", action: "check", frequency: 1, ev: 0.5 }],
          meta: { source: "live", solveMs: 3, solvedAt: "2026-02-04T00:00:00.000Z" },
        });
      },
    });

    const out = transport.solve(request, { timeoutMs: 500 });
    expect("ok" in out).toBe(false);
    if (!("ok" in out)) {
      expect(out.nodeHash).toBe("node-hash-1");
      expect(out.actions[0]?.actionId).toBe("CHECK");
    }
  });

  it("maps timeout failures to SOLVER_TIMEOUT", () => {
    const transport = createOpenSpielServiceTransport({
      command: "python",
      args: ["bridge.py"],
      runner: () => {
        const error = new Error("timeout") as Error & { code?: string };
        error.code = "ETIMEDOUT";
        throw error;
      },
    });

    const out = transport.solve(request, { timeoutMs: 5 });
    expect("ok" in out && out.ok === false).toBe(true);
    if ("ok" in out && out.ok === false) {
      expect(out.code).toBe("SOLVER_TIMEOUT");
      expect(out.retriable).toBe(true);
    }
  });
});
