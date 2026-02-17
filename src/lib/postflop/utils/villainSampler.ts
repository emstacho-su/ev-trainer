// src/lib/postflop/utils/villainSampler.ts
// Weighted random sampling of villain actions from solver output.

import type { SolverNodeOutput } from '../../engine/solverAdapter';

/**
 * Sample a villain action from solver output weighted by frequency.
 * Returns the actionId string of the sampled action.
 * Falls back to 'CHECK' if no actions available.
 */
export function sampleVillainAction(solverOutput: SolverNodeOutput): string {
  const { actions } = solverOutput;

  if (actions.length === 0) {
    return 'CHECK';
  }

  // Normalize frequencies (may not sum to exactly 1 due to floating point)
  const totalFreq = actions.reduce((sum, a) => sum + a.frequency, 0);
  if (totalFreq <= 0) {
    return actions[0].actionId;
  }

  const roll = Math.random() * totalFreq;
  let cumulative = 0;

  for (const action of actions) {
    cumulative += action.frequency;
    if (roll <= cumulative) {
      return action.actionId;
    }
  }

  // Floating point fallback: return last action
  return actions[actions.length - 1].actionId;
}
