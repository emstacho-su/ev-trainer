// src/lib/engine/openSpielSolver.test.ts

import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "./nodeTypes";
import { openSpielSolve } from "./openSpielSolver";

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
  it("returns valid solver output namespaced as openspiel", () => {
    const out = openSpielSolve(node);
    expect(out.status).toBe("ok");
    expect(out.units).toBe("bb");
    expect(out.nodeId?.startsWith("openspiel:")).toBe(true);
    expect(out.actions.length).toBeGreaterThan(0);
  });
});

