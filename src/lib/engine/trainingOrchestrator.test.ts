// src/lib/engine/trainingOrchestrator.test.ts

import { describe, expect, it } from "vitest";
import { MemoryNodeCache } from "./nodeCache";
import type { CanonicalNode } from "./nodeTypes";
import type { SolverNodeOutput } from "./solverAdapter";
import type { DecisionGrade, DecisionStore } from "./trainingOrchestrator";
import { advanceHandPlayStep, runSpotQuizDecision } from "./trainingOrchestrator";

const baseNode: CanonicalNode = {
  gameVersion: "g1",
  abstractionVersion: "a1",
  solverVersion: "s1",
  publicState: {
    street: "FLOP",
    potBb: 10,
    effectiveStackBb: 90,
    board: ["Ah", "7d", "2c"],
    toAct: "BTN",
  },
  history: { actions: [] },
  toAct: "BTN",
  abstraction: {
    betSizesBb: [3.3, 7.5],
    raiseSizesBb: [20, 100],
    maxRaisesPerStreet: 2,
  },
};

const spotOutput: SolverNodeOutput = {
  status: "ok",
  units: "bb",
  actions: [
    { actionId: "CHECK", frequency: 0.7, ev: 1.2 },
    { actionId: "BET_75PCT", frequency: 0.3, ev: 0.8 },
  ],
};

describe("runSpotQuizDecision", () => {
  it("fetches node, grades action, and stores decision", () => {
    const cache = new MemoryNodeCache();
    const records: DecisionGrade[] = [];
    const decisionStore: DecisionStore = {
      add(record) {
        records.push(record.grade);
      },
    };
    let seq = 0;
    const recordFactory = () => {
      seq += 1;
      return { recordId: `rec_${seq}`, createdSeq: seq };
    };

    const gradeDecision = (output: SolverNodeOutput, userActionId: string): DecisionGrade => {
      const epsilon = 1e-9;
      const actions = output.actions;
      const evMix = actions.reduce((sum, action) => sum + action.frequency * action.ev, 0);
      const evBest = Math.max(...actions.map((action) => action.ev));
      const user = actions.find((action) => action.actionId === userActionId);
      if (!user) throw new Error("missing action");
      const isBestAction = evBest - user.ev <= epsilon;
      return {
        evUser: user.ev,
        evMix,
        evBest,
        evLossVsMix: evMix - user.ev,
        evLossVsBest: evBest - user.ev,
        pureMistake: user.frequency === 0,
        policyDivergence: 1 - user.frequency,
        isBestAction,
      };
    };

    const result = runSpotQuizDecision(baseNode, "CHECK", {
      cache,
      solve: () => spotOutput,
      decisionStore,
      gradeDecision,
      seed: "seed-quiz",
      runtimeKey: "seed-quiz::session-quiz",
      recordFactory,
      requestSnapshot: { mode: "spot-quiz", payload: { node: baseNode, userActionId: "CHECK" } },
      configSnapshot: { streets: ["FLOP"] },
      now: () => "2026-01-28T12:00:00.000Z",
    });

    expect(result.record.nodeHash).toBe(result.nodeHash);
    expect(result.record.mode).toBe("spot-quiz");
    expect(records).toHaveLength(1);
    expect(result.grade).toEqual(gradeDecision(spotOutput, "CHECK"));
  });
});

describe("advanceHandPlayStep", () => {
  it("advances through opponent sampling and stores the user decision", () => {
    const cache = new MemoryNodeCache();
    const records: DecisionGrade[] = [];
    const decisionStore: DecisionStore = {
      add(record) {
        records.push(record.grade);
      },
    };
    let seq = 0;
    const recordFactory = () => {
      seq += 1;
      return { recordId: `rec_${seq}`, createdSeq: seq };
    };

    const opponentNode: CanonicalNode = {
      ...baseNode,
      publicState: { ...baseNode.publicState, toAct: "BB" },
      toAct: "BB",
    };

    const opponentOutput: SolverNodeOutput = {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CALL", frequency: 1, ev: 0.5 },
        { actionId: "FOLD", frequency: 0, ev: -1 },
      ],
    };

    const solve = (node: CanonicalNode) => (node.toAct === "BTN" ? spotOutput : opponentOutput);

    const gradeDecision = (output: SolverNodeOutput, userActionId: string): DecisionGrade => {
      const epsilon = 1e-9;
      const actions = output.actions;
      const evMix = actions.reduce((sum, action) => sum + action.frequency * action.ev, 0);
      const evBest = Math.max(...actions.map((action) => action.ev));
      const user = actions.find((action) => action.actionId === userActionId);
      if (!user) throw new Error("missing action");
      const isBestAction = evBest - user.ev <= epsilon;
      return {
        evUser: user.ev,
        evMix,
        evBest,
        evLossVsMix: evMix - user.ev,
        evLossVsBest: evBest - user.ev,
        pureMistake: user.frequency === 0,
        policyDivergence: 1 - user.frequency,
        isBestAction,
      };
    };

    const result = advanceHandPlayStep(
      { node: baseNode, userActionId: "CHECK", sequenceIndex: 0 },
      {
        cache,
        solve,
        decisionStore,
        gradeDecision,
        seed: "seed-hand",
        runtimeKey: "seed-hand::session-hand",
        recordFactory,
        requestSnapshot: {
          mode: "hand-play",
          payload: { node: baseNode, userActionId: "CHECK", sequenceIndex: 0 },
        },
        configSnapshot: { streets: ["FLOP"] },
        now: () => "2026-01-28T12:00:00.000Z",
        resolveNextNode: (_node, _actionId, actor) => (actor === "user" ? opponentNode : null),
      }
    );

    expect(records).toHaveLength(1);
    expect(result.record.mode).toBe("hand-play");
    expect(result.opponentAction).toBe("CALL");
    expect(result.nextNode).toBeNull();
  });
});
