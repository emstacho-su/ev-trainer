// src/lib/engine/openSpielSolver.ts

import type { CanonicalNode } from "./nodeTypes";
import type { SolverNodeOutput } from "./solverAdapter";
import { mockSolve } from "./mockSolver";

// Placeholder OpenSpiel-backed solve path for P1 integration.
export function openSpielSolve(node: CanonicalNode): SolverNodeOutput {
  const out = mockSolve(node);
  const suffix = out.nodeId ? out.nodeId.replace(/^mock:/, "") : "node";
  return {
    ...out,
    nodeId: `openspiel:${suffix}`,
  };
}

