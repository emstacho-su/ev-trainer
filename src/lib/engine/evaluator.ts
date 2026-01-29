// src/lib/engine/evaluator.ts

import type { CanonicalNode } from "./nodeTypes";
import type { SolverNodeOutput } from "./solverAdapter";
import type { Spot } from "./spot";
import type { Action } from "./action";
import { mockSolve } from "./mockSolver";

export interface EvaluationRequest {
  node: CanonicalNode;
  spot?: Spot;
  candidateActions?: Action[];
}

// Evaluator boundary for solver/oracle integrations.
export interface Evaluator {
  evaluate(request: EvaluationRequest): SolverNodeOutput;
}

// Deterministic mock evaluator for tests and local dev.
export function createMockEvaluator(): Evaluator {
  return {
    evaluate({ node }) {
      return mockSolve(node);
    },
  };
}
