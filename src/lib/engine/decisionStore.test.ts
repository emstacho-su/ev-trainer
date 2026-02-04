import { describe, expect, it } from "vitest";
import { MemoryDecisionStore } from "./decisionStore";
import type { DecisionRecord } from "./trainingOrchestrator";

function makeRecord(input: {
  recordId: string;
  createdSeq: number;
  evLossVsMix: number;
  createdAt: string;
}): DecisionRecord {
  return {
    recordId: input.recordId,
    createdSeq: input.createdSeq,
    runtimeKey: "seed::session",
    id: input.recordId,
    request: { mode: "spot-quiz", payload: {} },
    metrics: {
      evUser: 0,
      evMix: 0,
      evBest: 0,
      evLossVsMix: input.evLossVsMix,
      evLossVsBest: 0,
    },
    nodeHash: "node-hash",
    sessionId: "session",
    mode: "spot-quiz",
    userActionId: "CHECK",
    grade: {
      evUser: 0,
      evMix: 0,
      evBest: 0,
      evLossVsMix: input.evLossVsMix,
      evLossVsBest: 0,
      pureMistake: false,
      policyDivergence: 0,
      isBestAction: true,
    },
    configSnapshot: {},
    seed: "seed",
    createdAt: input.createdAt,
  };
}

describe("MemoryDecisionStore", () => {
  it("orders review list by evLossVsMix desc with deterministic tie-breaks", () => {
    const store = new MemoryDecisionStore();
    store.add(
      makeRecord({
        recordId: "rec-2",
        createdSeq: 2,
        evLossVsMix: 0.8,
        createdAt: "2026-01-01T00:00:01.000Z",
      })
    );
    store.add(
      makeRecord({
        recordId: "rec-1",
        createdSeq: 1,
        evLossVsMix: 0.8,
        createdAt: "2026-01-01T00:00:00.000Z",
      })
    );
    store.add(
      makeRecord({
        recordId: "rec-3",
        createdSeq: 3,
        evLossVsMix: 0.3,
        createdAt: "2026-01-01T00:00:02.000Z",
      })
    );

    const sorted = store.list({ sort: "evLossVsMixDesc" });
    expect(sorted.map((r) => r.recordId)).toEqual(["rec-1", "rec-2", "rec-3"]);
  });
});
