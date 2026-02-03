import { describe, expect, it } from "vitest";
import {
  applyAction,
  createSession,
  InMemorySpotSource,
  nextSpot,
} from "./index";
import type { CanonicalNode } from "./nodeTypes";
import type { SpotQuizResponse } from "./trainingApi";

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

describe("engine public API", () => {
  it("runs a spot-quiz flow using only public exports", () => {
    const session = createSession({ seed: "seed-1", sessionId: "session-1" });
    const node = buildNode(6);
    const result = applyAction(session, {
      mode: "spot-quiz",
      node,
      userActionId: "CHECK",
    }) as SpotQuizResponse;
    expect(result.grade.evLossVsMix).toBeDefined();
    expect(result.record.mode).toBe("spot-quiz");
  });

  it("selects a targeted spot deterministically via SpotSource", () => {
    const candidates = [
      { node: buildNode(6), boardBucket: "rainbow" },
      { node: buildNode(12, "BB"), boardBucket: "paired" },
    ];
    const source = new InMemorySpotSource(candidates);
    const first = nextSpot(source, { streets: ["FLOP"] }, "seed-x", 1);
    const second = nextSpot(source, { streets: ["FLOP"] }, "seed-x", 1);
    expect(first?.node.publicState.board).toEqual(second?.node.publicState.board);
  });
});
