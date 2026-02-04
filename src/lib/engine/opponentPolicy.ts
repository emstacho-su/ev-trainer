// src/lib/engine/opponentPolicy.ts

import type { SolverActionOutput } from "./solverAdapter";
import { combineSeed, createSeededRng } from "./rng";

export interface OpponentPolicyContext {
  nodeHash: string;
  sequenceIndex: number;
  seed: string;
}

export type PolicyTransform = (
  action: SolverActionOutput,
  context: OpponentPolicyContext
) => number;

export interface OpponentPolicy {
  base: SolverActionOutput[];
  transforms?: PolicyTransform[];
}

export interface OpponentActionSample {
  action: SolverActionOutput;
  rngState: string;
}

function compareActionId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function assertUniqueActionIds(actions: SolverActionOutput[]): void {
  const seen = new Set<string>();
  for (let i = 0; i < actions.length; i++) {
    const id = actions[i].actionId;
    if (seen.has(id)) {
      throw new Error(`policy.base has duplicate actionId '${id}'`);
    }
    seen.add(id);
  }
}

function normalizeWeights(weights: number[]): number[] {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (!Number.isFinite(w) || w < 0) {
      throw new Error("transform weights must be finite and >= 0");
    }
    sum += w;
  }
  if (sum <= 0) {
    throw new Error("transform weights must sum to > 0");
  }
  return weights.map((w) => w / sum);
}

export function buildOpponentSeed(context: OpponentPolicyContext): string {
  return combineSeed([context.seed, context.nodeHash, context.sequenceIndex]);
}

export function applyPolicyTransforms(
  actions: SolverActionOutput[],
  context: OpponentPolicyContext,
  transforms: PolicyTransform[] = []
): number[] {
  const weights = actions.map((action) => {
    let weight = action.frequency;
    for (let i = 0; i < transforms.length; i++) {
      weight *= transforms[i](action, context);
    }
    return weight;
  });

  return normalizeWeights(weights);
}

export function sampleOpponentAction(
  policy: OpponentPolicy,
  context: OpponentPolicyContext
): OpponentActionSample {
  if (!Array.isArray(policy.base) || policy.base.length === 0) {
    throw new Error("policy.base must be a non-empty array");
  }
  assertUniqueActionIds(policy.base);

  const probabilities = applyPolicyTransforms(policy.base, context, policy.transforms ?? []);
  const weightedActions = policy.base
    .map((action, index) => ({ action, probability: probabilities[index] }))
    .sort((a, b) => compareActionId(a.action.actionId, b.action.actionId));
  const rng = createSeededRng(buildOpponentSeed(context));
  const roll = rng.next();

  let cumulative = 0;
  for (let i = 0; i < weightedActions.length; i++) {
    cumulative += weightedActions[i].probability;
    if (roll < cumulative || i === weightedActions.length - 1) {
      return {
        action: weightedActions[i].action,
        rngState: rng.state(),
      };
    }
  }

  return {
    action: weightedActions[weightedActions.length - 1].action,
    rngState: rng.state(),
  };
}
