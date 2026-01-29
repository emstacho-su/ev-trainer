// src/lib/engine/mockSolver.ts

import { createHash } from "node:crypto";
import type { SolverNodeOutput } from "./solverAdapter";
import type { CanonicalNode } from "./nodeTypes";
import { buildCanonicalNodeHash } from "./canonicalHash";

function hashToUint32(hex: string): number {
  const slice = hex.slice(0, 8);
  return Number.parseInt(slice, 16) >>> 0;
}

export function mockSolve(request: CanonicalNode): SolverNodeOutput {
  const nodeHash = buildCanonicalNodeHash({
    gameVersion: request.gameVersion,
    abstractionVersion: request.abstractionVersion,
    solverVersion: request.solverVersion,
    publicState: request.publicState,
    history: request.history,
    toAct: request.toAct,
    abstraction: request.abstraction,
    toAct: request.toAct,
  });

  const seed = hashToUint32(nodeHash);
  const freqA = 0.2 + ((seed % 61) / 100); // 0.20 - 0.80
  const freqB = 1 - freqA;
  const baseEv = ((seed % 2001) - 1000) / 100; // -10.00 .. 10.00

  const nodeId = createHash("sha256").update(`mock:${nodeHash}`).digest("hex");

  return {
    nodeId: `mock:${nodeId.slice(0, 12)}`,
    actions: [
      {
        actionId: "CHECK",
        frequency: freqA,
        ev: baseEv,
      },
      {
        actionId: "BET_75PCT",
        frequency: freqB,
        ev: baseEv - 0.5,
      },
    ],
    status: "ok",
    units: "bb",
  };
}
