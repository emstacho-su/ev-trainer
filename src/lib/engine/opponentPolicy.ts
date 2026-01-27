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

  const probabilities = applyPolicyTransforms(policy.base, context, policy.transforms ?? []);
  const rng = createSeededRng(buildOpponentSeed(context));
  const roll = rng.next();

  let cumulative = 0;
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (roll <= cumulative || i === probabilities.length - 1) {
      return {
        action: policy.base[i],
        rngState: rng.state(),
      };
    }
  }

  return {
    action: policy.base[policy.base.length - 1],
    rngState: rng.state(),
  };
}
