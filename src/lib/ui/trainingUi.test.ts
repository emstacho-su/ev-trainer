// src/lib/ui/trainingUi.test.ts

import { describe, expect, it } from "vitest";
import type { DecisionRecord } from "../engine/trainingOrchestrator";
import type { SolverActionOutput } from "../engine/solverAdapter";
import {
  renderHandPlayView,
  renderReviewView,
  renderSpotQuizView,
  renderTargetedDrillView,
} from "./trainingUi";

const actions: SolverActionOutput[] = [
  { actionId: "CHECK", frequency: 0.55, ev: 0.4 },
  { actionId: "BET_75PCT", frequency: 0.45, ev: -0.2 },
];

const makeRecord = (id: string, evLossVsMix: number): DecisionRecord => ({
  id,
  nodeHash: `hash-${id}`,
  mode: "spot-quiz",
  userActionId: "CHECK",
  grade: {
    evUser: 0.1,
    evMix: 0.2,
    evBest: 0.4,
    evLossVsMix,
    evLossVsBest: 0.3,
    pureMistake: false,
    policyDivergence: 0.1,
  },
  configSnapshot: { streets: ["FLOP"] },
  seed: "seed",
  createdAt: "2026-01-28T00:00:00.000Z",
});

describe("training UI renderers", () => {
  it("renders spot quiz EV feedback and actions", () => {
    const html = renderSpotQuizView({
      prompt: "Pick the highest EV line.",
      actions,
      selectedActionId: "CHECK",
      evLossVsMix: 0.12,
      evLossVsBest: 0.25,
    });

    expect(html).toContain("EV Loss vs Mix");
    expect(html).toContain("CHECK");
    expect(html).toContain("BET_75PCT");
  });

  it("renders hand play log and stepper", () => {
    const html = renderHandPlayView({
      prompt: "Advance the hand with discipline.",
      actions,
      selectedActionId: "BET_75PCT",
      step: 3,
      log: [
        { step: 1, actor: "user", actionId: "CHECK" },
        { step: 2, actor: "opponent", actionId: "BET_75PCT" },
      ],
    });

    expect(html).toContain("Hand Play");
    expect(html).toContain("Step 3");
    expect(html).toContain("opponent");
  });

  it("renders targeted drill filter controls including verbosity", () => {
    const html = renderTargetedDrillView({
      prompt: "Focus on thin value decisions.",
      streets: ["FLOP", "TURN"],
      boardBuckets: ["paired", "rainbow"],
      maxRaisesPerStreet: 2,
      betSizesBb: [0.5],
      raiseSizesBb: [1.5],
      verbosity: "detailed",
    });

    expect(html).toContain("Streets");
    expect(html).toContain("Board buckets");
    expect(html).toContain("Tree restrictions");
    expect(html).toContain("Verbosity");
  });

  it("orders review items by EV loss vs mix descending", () => {
    const html = renderReviewView({
      title: "Review",
      items: [makeRecord("a", 0.1), makeRecord("b", 0.5), makeRecord("c", 0.3)],
    });

    const firstIndex = html.indexOf("hash-b");
    const secondIndex = html.indexOf("hash-c");
    const thirdIndex = html.indexOf("hash-a");

    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(-1);
    expect(thirdIndex).toBeGreaterThan(-1);
    expect(firstIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
  });
});
