// src/lib/runtime/http/handlers.test.ts

import { beforeEach, describe, expect, it } from "vitest";
import type { CanonicalNode } from "../../engine/nodeTypes";
import type { ReviewDetailResponse, ReviewListResponse, SpotQuizResponse } from "../../engine/trainingApi";
import { clearRuntimeRegistry } from "../runtimeRegistry";
import {
  handleReviewDetail,
  handleReviewList,
  handleSpotQuiz,
  type HandlerResult,
} from "./handlers";

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

function expectOk<T>(result: HandlerResult<T>): T {
  if (result.status !== 200) {
    throw new Error(`expected status 200, got ${result.status}`);
  }
  return result.body as T;
}

const baseSession = {
  seed: "seed:test",
  sessionId: "session:test",
};

describe("runtime http handlers", () => {
  beforeEach(() => {
    clearRuntimeRegistry();
  });

  it("runs spot quiz and returns review list ordered by EV loss with deterministic results", () => {
    expectOk<SpotQuizResponse>(
      handleSpotQuiz({
        ...baseSession,
        node: makeNode(10),
        userActionId: "BET_75PCT",
      })
    );
    expectOk<SpotQuizResponse>(
      handleSpotQuiz({
        ...baseSession,
        node: makeNode(20),
        userActionId: "BET_75PCT",
      })
    );

    const list = expectOk<ReviewListResponse>(handleReviewList(baseSession));
    expect(list.items.length).toBeGreaterThanOrEqual(2);
    expect(list.items[0].grade.evLossVsMix).toBeGreaterThanOrEqual(
      list.items[1].grade.evLossVsMix
    );

    clearRuntimeRegistry();

    expectOk<SpotQuizResponse>(
      handleSpotQuiz({
        ...baseSession,
        node: makeNode(10),
        userActionId: "BET_75PCT",
      })
    );
    expectOk<SpotQuizResponse>(
      handleSpotQuiz({
        ...baseSession,
        node: makeNode(20),
        userActionId: "BET_75PCT",
      })
    );

    const repeat = expectOk<ReviewListResponse>(handleReviewList(baseSession));
    expect(repeat.items).toHaveLength(list.items.length);
    expect(repeat.items.map((item) => item.id)).toEqual(list.items.map((item) => item.id));
    expect(repeat.items.map((item) => item.createdAt)).toEqual(
      list.items.map((item) => item.createdAt)
    );
  });

  it("returns review detail for a decision id", () => {
    const spot = expectOk<SpotQuizResponse>(
      handleSpotQuiz({
        ...baseSession,
        node: makeNode(15),
        userActionId: "CHECK",
      })
    );

    const detail = expectOk<ReviewDetailResponse>(
      handleReviewDetail({
        ...baseSession,
        id: spot.record.id,
        node: makeNode(15),
      })
    );

    expect(detail.record?.id).toBe(spot.record.id);
    expect(detail.output?.actions.length).toBeGreaterThan(0);
  });

  it("returns 400 for invalid canonical node payloads", () => {
    const result = handleSpotQuiz({
      ...baseSession,
      node: { bad: "shape" },
      userActionId: "CHECK",
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "node is invalid" });
  });
});
