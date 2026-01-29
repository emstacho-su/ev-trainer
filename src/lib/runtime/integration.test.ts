// src/lib/runtime/integration.test.ts

import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "../engine/nodeTypes";
import type { SolverNodeOutput } from "../engine/solverAdapter";
import type { ActionId } from "../engine/types";
import { MemoryDecisionStore } from "../engine/decisionStore";
import { MemoryNodeCache } from "../engine/nodeCache";
import { createTrainingApi } from "../engine/trainingApi";
import type { DecisionGrade } from "../engine/trainingOrchestrator";
import type { SpotCandidate } from "../engine/spotSelection";

const baseNode: CanonicalNode = {
  gameVersion: "g1",
  abstractionVersion: "a1",
  solverVersion: "s1",
  publicState: {
    street: "FLOP",
    potBb: 6,
    effectiveStackBb: 100,
    board: ["Ah", "Kd", "7c"],
    toAct: "BTN",
  },
  history: {
    actions: ["CHECK"],
  },
  toAct: "BTN",
  abstraction: {
    betSizesBb: [0.5],
    raiseSizesBb: [1],
    maxRaisesPerStreet: 1,
  },
};

const altNode: CanonicalNode = {
  gameVersion: "g1",
  abstractionVersion: "a1",
  solverVersion: "s1",
  publicState: {
    street: "FLOP",
    potBb: 12,
    effectiveStackBb: 100,
    board: ["Qs", "Qd", "4c"],
    toAct: "BB",
  },
  history: {
    actions: ["CHECK", "BET_50PCT"],
  },
  toAct: "BB",
  abstraction: {
    betSizesBb: [0.5],
    raiseSizesBb: [1],
    maxRaisesPerStreet: 1,
  },
};

function solveNode(node: CanonicalNode): SolverNodeOutput {
  if (node.publicState.potBb >= 10) {
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
  return {
    evUser,
    evMix,
    evBest,
    evLossVsMix: evMix - evUser,
    evLossVsBest: evBest - evUser,
    pureMistake: false,
    policyDivergence: Math.abs(user.frequency - 0.5),
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

describe("runtime integration behavior", () => {
  it("is deterministic for opponent sampling and targeted spot selection with the same seed", () => {
    const cache = new MemoryNodeCache();
    const decisions = new MemoryDecisionStore();
    const recordFactory = createRecordFactory();
    const now = createDeterministicNow();
    const api = createTrainingApi({
      cache,
      solve: solveNode,
      decisionStore: decisions,
      gradeDecision,
      seed: "seed-alpha",
      runtimeKey: "seed-alpha::session-alpha",
      recordFactory,
      configSnapshot: { streets: ["FLOP"] },
      sessionId: "session-alpha",
      now,
      resolveNextNode: (node, _actionId, actor) => {
        if (actor === "user") {
          return { ...node, toAct: "BB", publicState: { ...node.publicState, toAct: "BB" } };
        }
        return null;
      },
    });

    const handPlayA = api.handPlayStep({
      node: baseNode,
      userActionId: "CHECK",
      sequenceIndex: 3,
    });
    const handPlayB = api.handPlayStep({
      node: baseNode,
      userActionId: "CHECK",
      sequenceIndex: 3,
    });

    expect(handPlayA.opponentAction).toBe(handPlayB.opponentAction);

    const candidates: SpotCandidate[] = [
      { node: baseNode, boardBucket: "rainbow" },
      { node: altNode, boardBucket: "paired" },
    ];

    const drillA = api.targetedDrill({
      candidates,
      filters: { streets: ["FLOP"], boardBuckets: ["rainbow", "paired"] },
      userActionId: "CHECK",
      sequenceIndex: 5,
    });
    const drillB = api.targetedDrill({
      candidates,
      filters: { streets: ["FLOP"], boardBuckets: ["rainbow", "paired"] },
      userActionId: "CHECK",
      sequenceIndex: 5,
    });

    expect(drillA.spot?.node.publicState.board).toEqual(
      drillB.spot?.node.publicState.board
    );
  });

  it("hits the solver cache for repeat spot-quiz requests", () => {
    const cache = new MemoryNodeCache();
    const decisions = new MemoryDecisionStore();
    let solveCalls = 0;
    const solve = (node: CanonicalNode): SolverNodeOutput => {
      solveCalls += 1;
      return solveNode(node);
    };
    const recordFactory = createRecordFactory();
    const now = createDeterministicNow();

    const api = createTrainingApi({
      cache,
      solve,
      decisionStore: decisions,
      gradeDecision,
      seed: "seed-beta",
      runtimeKey: "seed-beta::session-beta",
      recordFactory,
      configSnapshot: { streets: ["FLOP"] },
      sessionId: "session-beta",
      now,
    });

    api.spotQuiz({
      node: baseNode,
      userActionId: "CHECK",
    });
    api.spotQuiz({
      node: baseNode,
      userActionId: "CHECK",
    });

    expect(solveCalls).toBe(1);
  });
});
