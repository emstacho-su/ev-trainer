// src/lib/engine/mockSolver.test.ts

import { describe, expect, it } from "vitest";
import { mockSolve } from "./mockSolver";
import type { CanonicalNode } from "./nodeTypes";

const baseRequest: CanonicalNode = {
  gameVersion: "HU-NLHE",
  abstractionVersion: "v1",
  solverVersion: "mock-0",
  publicState: {
    street: "TURN",
    potBb: 9.5,
    effectiveStackBb: 86,
    board: ["Ah", "7d", "2c", "Kd"],
    toAct: "BB",
  },
  history: {
    actions: ["CHECK", "BET_5", "CALL"],
  },
  toAct: "BB",
  abstraction: {
    betSizesBb: [2.5, 5, 7.5],
    raiseSizesBb: [12.5, 25],
    maxRaisesPerStreet: 2,
  },
};

describe("mockSolve", () => {
  it("is deterministic for the same input", () => {
    const first = mockSolve(baseRequest);
    const second = mockSolve({ ...baseRequest });
    expect(first).toEqual(second);
  });
});
