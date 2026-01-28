// src/lib/runtime/gradeDecision.ts

import type { SolverNodeOutput } from "../engine/solverAdapter";
import type { ActionId } from "../engine/types";
import type { DecisionGrade } from "../engine/trainingOrchestrator";

const EV_EPS = 1e-9;

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

export function gradeDecision(output: SolverNodeOutput, userActionId: ActionId): DecisionGrade {
  if (output.status !== "ok") {
    throw new Error("gradeDecision requires solver output status 'ok'");
  }
  if (!Array.isArray(output.actions) || output.actions.length === 0) {
    throw new Error("gradeDecision requires non-empty solver actions");
  }

  const user = output.actions.find((action) => action.actionId === userActionId);
  if (!user) {
    throw new Error("user action not in solver output");
  }

  let evMix = 0;
  let evBest = -Infinity;
  for (const action of output.actions) {
    assertFiniteNumber(action.frequency, "action.frequency");
    assertFiniteNumber(action.ev, "action.ev");
    evMix += action.frequency * action.ev;
    if (action.ev > evBest) evBest = action.ev;
  }

  assertFiniteNumber(evMix, "evMix");
  const evUser = user.ev;
  assertFiniteNumber(evUser, "evUser");

  const evLossVsMix = evMix - evUser;
  const evLossVsBest = evBest - evUser;
  const pureMistake = evUser < evBest - EV_EPS;
  const policyDivergence = Math.max(0, Math.min(1, 1 - user.frequency));

  return {
    evUser,
    evMix,
    evBest,
    evLossVsMix,
    evLossVsBest,
    pureMistake,
    policyDivergence,
  };
}
