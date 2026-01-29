import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "./nodeTypes";
import { InMemorySpotSource } from "./spotSource";
import type { SpotCandidate } from "./spotSelection";

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

describe("spotSource", () => {
  it("selects deterministically with the same seed and sequence index", () => {
    const candidates: SpotCandidate[] = [
      { node: buildNode(6), boardBucket: "rainbow" },
      { node: buildNode(12, "BB"), boardBucket: "paired" },
    ];
    const source = new InMemorySpotSource(candidates);
    const first = source.select({ streets: ["FLOP"] }, "seed-1", 2);
    const second = source.select({ streets: ["FLOP"] }, "seed-1", 2);
    expect(first?.node.publicState.board).toEqual(second?.node.publicState.board);
  });
});
