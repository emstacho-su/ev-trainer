// src/lib/runtime/gradeDecision.test.ts

import { describe, expect, it } from "vitest";
import type { SolverNodeOutput } from "../engine/solverAdapter";
import { gradeDecision } from "./gradeDecision";

describe("gradeDecision", () => {
  it("computes EV mix, best, and losses deterministically", () => {
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
