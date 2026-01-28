// src/lib/engine/grading.test.ts

import { describe, expect, it } from "vitest";
import type { SolverNodeOutput } from "./solverAdapter";
import type { ActionId } from "./types";
import type { DecisionGrade } from "./trainingOrchestrator";

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

describe("gradeDecision", () => {
  it("computes EV mix, best, and losses for a golden output", () => {
    const output: SolverNodeOutput = {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: 0.6, ev: 1.2 },
        { actionId: "BET_75PCT", frequency: 0.4, ev: 0.4 },
      ],
    };

    const grade = gradeDecision(output, "BET_75PCT");

    expect(grade.evMix).toBeCloseTo(0.88, 6);
    expect(grade.evBest).toBeCloseTo(1.2, 6);
    expect(grade.evUser).toBeCloseTo(0.4, 6);
    expect(grade.evLossVsMix).toBeCloseTo(0.48, 6);
    expect(grade.evLossVsBest).toBeCloseTo(0.8, 6);
  });
});
