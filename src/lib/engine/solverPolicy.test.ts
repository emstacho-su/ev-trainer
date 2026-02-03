// src/lib/engine/solverPolicy.test.ts

import { describe, expect, it } from "vitest";
import {
  assertCommercialSolverPolicy,
  isCommerciallyApprovedProvider,
} from "./solverPolicy";

describe("solverPolicy", () => {
  it("marks openspiel as commercially approved", () => {
    expect(isCommerciallyApprovedProvider("openspiel")).toBe(true);
  });

  it("blocks providers that are not approved", () => {
    expect(() => assertCommercialSolverPolicy("precomputed")).toThrow("LICENSE_BLOCKED");
  });

  it("enforces legal approval flag", () => {
    expect(() =>
      assertCommercialSolverPolicy("openspiel", {
        legalApproved: false,
      })
    ).toThrow("LICENSE_BLOCKED");
  });
});

