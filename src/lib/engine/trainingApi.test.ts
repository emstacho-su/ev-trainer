// src/lib/engine/trainingApi.test.ts

import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "./nodeTypes";
import type { SolverNodeOutput } from "./solverAdapter";
import type { ActionId } from "./types";
import type { DecisionGrade } from "./trainingOrchestrator";
import { MemoryNodeCache } from "./nodeCache";
import { MemoryDecisionStore } from "./decisionStore";
import { createTrainingApi } from "./trainingApi";

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

function solveForPot(node: CanonicalNode): SolverNodeOutput {
  const pot = node.publicState.potBb;
  if (pot >= 10) {
    return {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: 0.7, ev: 1.0 },
        { actionId: "BET_75PCT", frequency: 0.3, ev: 0.2 },
      ],
    };
  }
  return {
    status: "ok",
    units: "bb",
    actions: [
      { actionId: "CHECK", frequency: 0.4, ev: 0.4 },
      { actionId: "BET_75PCT", frequency: 0.6, ev: -0.5 },
    ],
  };
}

function gradeDecision(output: SolverNodeOutput, userActionId: ActionId): DecisionGrade {
  const epsilon = 1e-9;
  const user = output.actions.find((action) => action.actionId === userActionId);
  if (!user) {
    throw new Error("user action not in solver output");
  }
  const evMix = output.actions.reduce(
    (sum, action) => sum + action.frequency * action.ev,
    0
  );
  const evBest = Math.max(...output.actions.map((action) => action.ev));
  const evUser = user.ev;
  const isBestAction = evBest - evUser <= epsilon;
  return {
    evUser,
    evMix,
    evBest,
    evLossVsMix: evMix - evUser,
    evLossVsBest: evBest - evUser,
    pureMistake: false,
    policyDivergence: Math.abs(user.frequency - 0.5),
    isBestAction,
  };
}

function createRecordFactory() {
  let seq = 0;
  return () => {
    seq += 1;
    return { recordId: `rec_${seq}`, createdSeq: seq };
  };
}

function createDeterministicNow() {
  let counter = 0;
  return () => {
    const base = Date.parse("2026-01-01T00:00:00.000Z");
    const timestamp = new Date(base + counter * 1000).toISOString();
    counter += 1;
    return timestamp;
  };
}

describe("trainingApi", () => {
  it("returns solver actions, grading, and decision metadata for spot quiz", () => {
    const cache = new MemoryNodeCache();
    const decisions = new MemoryDecisionStore();
    const recordFactory = createRecordFactory();
    const api = createTrainingApi({
      cache,
      solve: solveForPot,
      decisionStore: decisions,
      gradeDecision,
      seed: "seed-1",
      runtimeKey: "seed-1::session-1",
      recordFactory,
      configSnapshot: { streets: ["FLOP"] },
      sessionId: "session-1",
      now: createDeterministicNow(),
    });

    const result = api.spotQuiz({
      node: buildNode(10),
      userActionId: "BET_75PCT",
      sessionId: "session-1",
    });

    expect(result.output.actions.length).toBeGreaterThan(0);
    expect(result.grade.evLossVsMix).toBeGreaterThan(0);
    expect(result.record.mode).toBe("spot-quiz");
    expect(result.record.sessionId).toBe("session-1");
  });

  it("advances hand-play steps with deterministic opponent sampling", () => {
    const cache = new MemoryNodeCache();
    const decisions = new MemoryDecisionStore();
    const recordFactory = createRecordFactory();
    const api = createTrainingApi({
      cache,
      solve: solveForPot,
      decisionStore: decisions,
      gradeDecision,
      seed: "seed-2",
      runtimeKey: "seed-2::session-2",
      recordFactory,
      configSnapshot: { streets: ["FLOP"] },
      sessionId: "session-2",
      now: createDeterministicNow(),
      resolveNextNode: (node, _actionId, actor) => {
        if (actor === "user") {
          return buildNode(node.publicState.potBb + 1, "BB");
        }
        return null;
      },
    });

    const result = api.handPlayStep({
      node: buildNode(10, "BTN"),
      userActionId: "CHECK",
      sequenceIndex: 0,
    });

    const repeat = api.handPlayStep({
      node: buildNode(10, "BTN"),
      userActionId: "CHECK",
      sequenceIndex: 0,
    });

    expect(result.output.actions.length).toBeGreaterThan(0);
    expect(result.opponentAction).toBeDefined();
    expect(result.opponentAction).toBe(repeat.opponentAction);
    expect(result.record.mode).toBe("hand-play");
  });

  it("selects a targeted drill spot and records grading output", () => {
    const cache = new MemoryNodeCache();
    const decisions = new MemoryDecisionStore();
    const recordFactory = createRecordFactory();
    const api = createTrainingApi({
      cache,
      solve: solveForPot,
      decisionStore: decisions,
      gradeDecision,
      seed: "seed-3",
      runtimeKey: "seed-3::session-3",
      recordFactory,
      configSnapshot: { streets: ["FLOP"] },
      sessionId: "session-3",
      now: createDeterministicNow(),
    });

    const result = api.targetedDrill({
      candidates: [{ node: buildNode(10) }, { node: buildNode(5) }],
      filters: {},
      userActionId: "CHECK",
      sequenceIndex: 1,
    });

    expect(result.spot).not.toBeNull();
    expect(result.output?.actions.length).toBeGreaterThan(0);
    expect(result.record?.mode).toBe("targeted-drill");
  });

  it("orders review list by EV loss vs mix descending by default", () => {
    const cache = new MemoryNodeCache();
    const decisions = new MemoryDecisionStore();
    const recordFactory = createRecordFactory();
    const api = createTrainingApi({
      cache,
      solve: solveForPot,
      decisionStore: decisions,
      gradeDecision,
      seed: "seed-4",
      runtimeKey: "seed-4::session-4",
      recordFactory,
      configSnapshot: { streets: ["FLOP"] },
      sessionId: "session-4",
      now: createDeterministicNow(),
    });

    api.spotQuiz({ node: buildNode(10), userActionId: "BET_75PCT" });
    api.spotQuiz({ node: buildNode(5), userActionId: "BET_75PCT" });

    const list = api.reviewList();
    expect(list.items.length).toBe(2);
    expect(list.items[0].grade.evLossVsMix).toBeGreaterThanOrEqual(
      list.items[1].grade.evLossVsMix
    );
  });

  it("returns review detail with solver output when node is provided", () => {
    const cache = new MemoryNodeCache();
    const decisions = new MemoryDecisionStore();
    const recordFactory = createRecordFactory();
    const api = createTrainingApi({
      cache,
      solve: solveForPot,
      decisionStore: decisions,
      gradeDecision,
      seed: "seed-5",
      runtimeKey: "seed-5::session-5",
      recordFactory,
      configSnapshot: { streets: ["FLOP"] },
      sessionId: "session-5",
      now: createDeterministicNow(),
    });

    const decision = api.spotQuiz({ node: buildNode(10), userActionId: "CHECK" });
    const detail = api.reviewDetail({ id: decision.record.id, node: buildNode(10) });

    expect(detail.record?.id).toBe(decision.record.id);
    expect(detail.output?.actions.length).toBeGreaterThan(0);
  });

  it("returns paginated review items with total equal to full filtered count", () => {
    const cache = new MemoryNodeCache();
    const decisions = new MemoryDecisionStore();
    const recordFactory = createRecordFactory();
    const api = createTrainingApi({
      cache,
      solve: solveForPot,
      decisionStore: decisions,
      gradeDecision,
      seed: "seed-6",
      runtimeKey: "seed-6::session-6",
      recordFactory,
      configSnapshot: { streets: ["FLOP"] },
      sessionId: "session-6",
      now: createDeterministicNow(),
    });

    api.spotQuiz({ node: buildNode(10), userActionId: "CHECK" });
    api.spotQuiz({ node: buildNode(11), userActionId: "CHECK" });
    api.spotQuiz({ node: buildNode(12), userActionId: "CHECK" });

    const paged = api.reviewList({ offset: 1, limit: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBe(3);
  });
});
