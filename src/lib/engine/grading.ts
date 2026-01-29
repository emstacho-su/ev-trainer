// src/lib/engine/grading.ts

import type { SolverNodeOutput } from "./solverAdapter";
import type { ActionId } from "./types";
import type { DecisionGrade } from "./trainingOrchestrator";

export interface ScoringThresholds {
  excellent: number;
  good: number;
  ok: number;
}

export interface ScoringConfig {
  epsilon?: number;
  gradeBy?: "evLossVsBest" | "evLossVsMix";
  thresholds?: ScoringThresholds;
}

const DEFAULT_EPS = 1e-9;

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function computeGradeLabel(loss: number, thresholds: ScoringThresholds): string {
  if (loss <= thresholds.excellent) return "A";
  if (loss <= thresholds.good) return "B";
  if (loss <= thresholds.ok) return "C";
  return "D";
}

// Grades a decision using solver output and EV-based thresholds.
export function gradeDecision(
  output: SolverNodeOutput,
  userActionId: ActionId,
  config: ScoringConfig = {}
): DecisionGrade {
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
  const epsilon = config.epsilon ?? DEFAULT_EPS;
  const isBestAction = evLossVsBest <= epsilon;
  const pureMistake = evUser < evBest - epsilon;
  const policyDivergence = Math.max(0, Math.min(1, 1 - user.frequency));

  let gradeLabel: string | undefined;
  if (config.thresholds) {
    const loss = config.gradeBy === "evLossVsMix" ? evLossVsMix : evLossVsBest;
    gradeLabel = computeGradeLabel(loss, config.thresholds);
  }

  return {
    evUser,
    evMix,
    evBest,
    evLossVsMix,
    evLossVsBest,
    pureMistake,
    policyDivergence,
    isBestAction,
    gradeLabel,
  };
}
