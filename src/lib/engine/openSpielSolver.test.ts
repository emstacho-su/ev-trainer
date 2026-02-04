// src/lib/engine/openSpielSolver.test.ts

import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "./nodeTypes";
import { mapCanonicalNodeToOpenSpielRequest, openSpielSolve } from "./openSpielSolver";

const node: CanonicalNode = {
  gameVersion: "HU-NLHE",
  abstractionVersion: "v1",
  solverVersion: "openspiel:1.0.0",
  publicState: {
    street: "FLOP",
    potBb: 4.5,
    effectiveStackBb: 100,
    board: ["Ah", "7d", "2c"],
    toAct: "BTN",
  },
  history: { actions: ["CHECK"] },
  toAct: "BTN",
  abstraction: {
    betSizesBb: [2.5, 5],
    raiseSizesBb: [7.5, 20],
    maxRaisesPerStreet: 2,
  },
};

describe("openSpielSolve", () => {
  it("maps canonical node input to an OpenSpiel request fixture", () => {
    const req = mapCanonicalNodeToOpenSpielRequest(node, "node-hash-1");
    expect(req.provider).toBe("openspiel");
    expect(req.nodeHash).toBe("node-hash-1");
    expect(req.state.street).toBe("flop");
    expect(req.state.toAct).toBe("hero");
    expect(req.actionHistory[0]).toEqual({
      actor: "hero",
      action: "check",
      sizeBb: undefined,
    });
  });

  it("returns valid solver output namespaced as openspiel", () => {
    const out = openSpielSolve(node);
    expect(out.status).toBe("ok");
    expect(out.units).toBe("bb");
    expect(out.nodeId?.startsWith("openspiel:")).toBe(true);
    expect(out.actions.length).toBeGreaterThan(0);
    expect(out.meta?.provider).toBe("openspiel");
    expect(out.meta?.source).toBe("live");
    expect(out.meta?.nodeHash).toBeDefined();
  });

  it("normalizes response actions deterministically by actionId", () => {
    const out = openSpielSolve(node, {
      transport: {
        solve: (request) => ({
          provider: "openspiel",
          nodeHash: request.nodeHash,
          actions: [
            { actionId: "BET_75PCT", action: "bet", sizeBb: 3.375, frequency: 2, ev: 0.2 },
            { actionId: "CHECK", action: "check", frequency: 8, ev: 0.8 },
          ],
          meta: { source: "live", solveMs: 2, solvedAt: "2026-02-04T00:00:00.000Z" },
        }),
      },
    });
    expect(out.actions.map((a) => a.actionId)).toEqual(["BET_75PCT", "CHECK"]);
    expect(out.actions[0]?.frequency).toBeCloseTo(0.2, 6);
    expect(out.actions[1]?.frequency).toBeCloseTo(0.8, 6);
  });

  it("maps timeout overruns to SOLVER_TIMEOUT", () => {
    const out = openSpielSolve(node, {
      timeoutMs: 5,
      transport: {
        solve: (request) => {
          const start = Date.now();
          while (Date.now() - start < 8) {
            // intentional busy wait for deterministic timeout path in sync test
          }
          return {
            provider: "openspiel",
            nodeHash: request.nodeHash,
            actions: [{ actionId: "CHECK", action: "check", frequency: 1, ev: 0.1 }],
            meta: { source: "live", solveMs: 8, solvedAt: "2026-02-04T00:00:00.000Z" },
          };
        },
      },
    });
    expect(out.status).toBe("error");
    expect(out.meta?.errorCode).toBe("SOLVER_TIMEOUT");
    expect(out.meta?.retriable).toBe(true);
  });

  it("maps unsupported node errors to unsolved status", () => {
    const out = openSpielSolve(node, {
      transport: {
        solve: () => ({
          ok: false,
          code: "UNSUPPORTED_NODE",
          message: "spot not available",
          retriable: false,
          provider: "openspiel",
          nodeHash: "ignored",
        }),
      },
    });
    expect(out.status).toBe("unsolved");
    expect(out.meta?.errorCode).toBe("UNSUPPORTED_NODE");
  });
});
