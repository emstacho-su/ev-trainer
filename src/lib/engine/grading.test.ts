// src/lib/engine/grading.test.ts

import { describe, expect, it } from "vitest";
import type { SolverNodeOutput } from "./solverAdapter";
import { gradeDecision } from "./grading";

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
    expect(grade.isBestAction).toBe(false);
  });

  it("normalizes frequencies before computing evMix and policy divergence", () => {
    const output: SolverNodeOutput = {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: 60, ev: 1.2 },
        { actionId: "BET_75PCT", frequency: 40, ev: 0.4 },
      ],
    };

    const grade = gradeDecision(output, "BET_75PCT");
    expect(grade.evMix).toBeCloseTo(0.88, 6);
    expect(grade.policyDivergence).toBeCloseTo(0.6, 6);
  });

  it("treats near-equal EV action as best based on epsilon", () => {
    const output: SolverNodeOutput = {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: 0.5, ev: 1.0000000000 },
        { actionId: "BET_75PCT", frequency: 0.5, ev: 1.0000000005 },
      ],
    };

    const defaultEpsGrade = gradeDecision(output, "CHECK");
    const strictEpsGrade = gradeDecision(output, "CHECK", { epsilon: 1e-12 });

    expect(defaultEpsGrade.isBestAction).toBe(true);
    expect(strictEpsGrade.isBestAction).toBe(false);
  });

  it("clamps evLossVsMix and evLossVsBest to non-negative values", () => {
    const output: SolverNodeOutput = {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: 0.8, ev: 1.0 },
        { actionId: "BET_75PCT", frequency: 0.2, ev: 1.5 },
      ],
    };

    const grade = gradeDecision(output, "BET_75PCT");
    expect(grade.evLossVsMix).toBe(0);
    expect(grade.evLossVsBest).toBe(0);
  });

  it("rejects invalid frequency vectors", () => {
    const negativeFrequency: SolverNodeOutput = {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: -0.1, ev: 1.0 },
        { actionId: "BET_75PCT", frequency: 1.1, ev: 0.5 },
      ],
    };
    expect(() => gradeDecision(negativeFrequency, "CHECK")).toThrow(/frequency/i);

    const zeroTotal: SolverNodeOutput = {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: 0, ev: 1.0 },
        { actionId: "BET_75PCT", frequency: 0, ev: 0.5 },
      ],
    };
    expect(() => gradeDecision(zeroTotal, "CHECK")).toThrow(/sum to > 0/i);
  });
});
