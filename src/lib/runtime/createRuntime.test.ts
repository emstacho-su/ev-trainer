// src/lib/runtime/createRuntime.test.ts

import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "../engine/nodeTypes";
import type { SolverNodeOutput } from "../engine/solverAdapter";
import { createRuntime } from "./createRuntime";

function makeNode(potBb: number): CanonicalNode {
  return {
    gameVersion: "test-game",
    abstractionVersion: "test-abstraction",
    solverVersion: "test-solver",
    publicState: {
      street: "FLOP",
      potBb,
      effectiveStackBb: 100,
      board: ["Ah", "Kd", "2c"],
      toAct: "BTN",
    },
    history: {
      actions: ["CHECK"],
    },
    toAct: "BTN",
    abstraction: {
      betSizesBb: [7.5],
      raiseSizesBb: [],
      maxRaisesPerStreet: 1,
    },
  };
}

describe("createRuntime", () => {
  it("records decisions and sorts review list by EV loss desc", () => {
    const timestamps = [
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:01.000Z",
    ];
    let tsIndex = 0;
    const now = () => timestamps[Math.min(tsIndex++, timestamps.length - 1)];

    const solve = (node: CanonicalNode): SolverNodeOutput => {
      if (node.publicState.potBb === 10) {
        return {
          status: "ok",
          units: "bb",
          actions: [
            { actionId: "CHECK", frequency: 0.7, ev: 1.0 },
            { actionId: "BET_75PCT", frequency: 0.3, ev: 0.2 },
          ],
        };
      }
      if (node.publicState.potBb === 20) {
        return {
          status: "ok",
          units: "bb",
          actions: [
            { actionId: "CHECK", frequency: 0.5, ev: 0.5 },
            { actionId: "BET_75PCT", frequency: 0.5, ev: -0.5 },
          ],
        };
      }
      throw new Error("unexpected node");
    };

    const runtime = createRuntime({
      seed: "seed:test",
      sessionId: "session:test",
      now,
      solve,
    });

    runtime.trainingApi.spotQuiz({
      node: makeNode(10),
      userActionId: "BET_75PCT",
    });
    runtime.trainingApi.spotQuiz({
      node: makeNode(20),
      userActionId: "BET_75PCT",
    });

    const review = runtime.trainingApi.reviewList({ sessionId: "session:test" });

    expect(review.items).toHaveLength(2);
    expect(review.items[0].grade.evLossVsMix).toBeCloseTo(0.56, 6);
    expect(review.items[1].grade.evLossVsMix).toBeCloseTo(0.5, 6);
  });
});
