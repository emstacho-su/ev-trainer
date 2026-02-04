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

function kahanSum(values: readonly number[]): number {
  let sum = 0;
  let c = 0;
  for (let i = 0; i < values.length; i++) {
    const y = values[i] - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  return sum;
}

function normalizedFrequencies(actions: SolverNodeOutput["actions"]): number[] {
  const raw: number[] = [];
  for (let i = 0; i < actions.length; i++) {
    const f = actions[i].frequency;
    assertFiniteNumber(f, "action.frequency");
    if (f < 0) {
      throw new Error("action.frequency must be >= 0");
    }
    raw.push(f);
  }

  const total = kahanSum(raw);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("action.frequency values must sum to > 0");
  }
  return raw.map((f) => f / total);
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

  const epsilon = config.epsilon ?? DEFAULT_EPS;
  assertFiniteNumber(epsilon, "epsilon");
  if (epsilon < 0) {
    throw new Error("epsilon must be >= 0");
  }

  const probabilities = normalizedFrequencies(output.actions);
  let evMix = 0;
  let evBest = -Infinity;
  let userProbability = 0;
  for (let i = 0; i < output.actions.length; i++) {
    const action = output.actions[i];
    const probability = probabilities[i];
    assertFiniteNumber(action.ev, "action.ev");
    evMix += probability * action.ev;
    if (action.ev > evBest) evBest = action.ev;
    if (action.actionId === userActionId) {
      userProbability = probability;
    }
  }

  assertFiniteNumber(evMix, "evMix");
  const evUser = user.ev;
  assertFiniteNumber(evUser, "evUser");

  const evLossVsMix = Math.max(0, evMix - evUser);
  const evLossVsBest = Math.max(0, evBest - evUser);
  const isBestAction = evLossVsBest <= epsilon;
  const pureMistake = evLossVsBest > epsilon;
  const policyDivergence = Math.max(0, Math.min(1, 1 - userProbability));

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
