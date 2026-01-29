import { describe, expect, it } from "vitest";
import { createMockEvaluator } from "./evaluator";
import type { CanonicalNode } from "./nodeTypes";

function buildNode(potBb: number, toAct: "BTN" | "BB" = "BTN"): CanonicalNode {
  return {
    gameVersion: "g1",
    abstractionVersion: "a1",
    solverVersion: "s1",
    publicState: {
      street: "FLOP",
      potBb,
      effectiveStackBb: 100,
      board: ["Ah", "Kd", "7c"],
      toAct,
    },
    history: {
      actions: ["CHECK"],
    },
    toAct,
    abstraction: {
      betSizesBb: [0.5],
      raiseSizesBb: [1],
      maxRaisesPerStreet: 1,
    },
  };
}

describe("evaluator", () => {
  it("returns deterministic output for the same node", () => {
    const evaluator = createMockEvaluator();
    const node = buildNode(6);
    const first = evaluator.evaluate({ node });
    const second = evaluator.evaluate({ node });
    expect(first).toEqual(second);
  });
});
