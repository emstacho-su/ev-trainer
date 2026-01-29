// src/lib/engine/opponentPolicy.test.ts

import { describe, expect, it } from "vitest";
import type { SolverActionOutput } from "./solverAdapter";
import {
  applyPolicyTransforms,
  buildOpponentSeed,
  sampleOpponentAction,
  type OpponentPolicyContext,
} from "./opponentPolicy";

const baseActions: SolverActionOutput[] = [
  { actionId: "CHECK", frequency: 0.7, ev: 0.2 },
  { actionId: "BET_75PCT", frequency: 0.3, ev: 0.1 },
];

const context: OpponentPolicyContext = {
  nodeHash: "node-abc",
  sequenceIndex: 0,
  seed: "session-1",
};

describe("sampleOpponentAction", () => {
  it("is deterministic for the same seed/context", () => {
    const first = sampleOpponentAction({ base: baseActions }, context);
    const second = sampleOpponentAction({ base: baseActions }, context);
    expect(first).toEqual(second);
  });

  it("changes with sequence index", () => {
    const first = sampleOpponentAction({ base: baseActions }, context);
    const second = sampleOpponentAction({ base: baseActions }, { ...context, sequenceIndex: 1 });
    expect(first).not.toEqual(second);
  });

  it("respects transform reweighting during sampling", () => {
    const transforms = [
      (action: SolverActionOutput) => (action.actionId === "BET_75PCT" ? 1 : 0),
    ];
    const sample = sampleOpponentAction({ base: baseActions, transforms }, context);
    expect(sample.action.actionId).toBe("BET_75PCT");
  });

  it("matches a golden sample for a fixed seed", () => {
    const sample = sampleOpponentAction({ base: baseActions }, context);
    expect(sample.action.actionId).toBe("BET_75PCT");
    expect(sample.rngState).toBe("9b2eb7a7");
  });
});

describe("applyPolicyTransforms", () => {
  it("reweights probabilities with transforms", () => {
    const transforms = [
      (action: SolverActionOutput) => (action.actionId === "BET_75PCT" ? 3 : 1),
    ];

    const probs = applyPolicyTransforms(baseActions, context, transforms);
    expect(probs.length).toBe(2);
    expect(probs[1]).toBeGreaterThan(probs[0]);
  });
});

describe("buildOpponentSeed", () => {
  it("combines seed parts deterministically", () => {
    expect(buildOpponentSeed(context)).toBe("session-1|node-abc|0");
  });
});
