// src/lib/engine/solverAdapterV2.test.ts

import { describe, expect, it } from "vitest";
import { normalizeSolverActionPolicies, type SolverActionPolicyV2 } from "./solverAdapter";

describe("normalizeSolverActionPolicies", () => {
  it("renormalizes frequencies and sorts by actionId", () => {
    const input: SolverActionPolicyV2[] = [
      { actionId: "raise_250", action: "raise", sizeBb: 25, frequency: 2, ev: 0.3 },
      { actionId: "call", action: "call", frequency: 1, ev: 0.1 },
    ];

    const out = normalizeSolverActionPolicies(input);
    expect(out.map((a) => a.actionId)).toEqual(["call", "raise_250"]);
    expect(out[0].frequency).toBeCloseTo(1 / 3, 8);
    expect(out[1].frequency).toBeCloseTo(2 / 3, 8);
  });

  it("rejects negative frequencies", () => {
    const bad: SolverActionPolicyV2[] = [
      { actionId: "fold", action: "fold", frequency: -0.1, ev: 0 },
      { actionId: "call", action: "call", frequency: 1.1, ev: 0.2 },
    ];

    expect(() => normalizeSolverActionPolicies(bad)).toThrow("frequency must be >= 0");
  });
});
