// src/lib/solver/cfr.ts
// CFR+ core algorithm components for counterfactual regret minimization.

import type { InfoSet, CFRConfig } from './types';

/**
 * Default CFR training configuration.
 *
 * These defaults are tuned for preflop solver:
 * - 1M iterations provides good convergence for preflop
 * - 0.1 mbb exploitability is sufficient for training purposes
 * - Check every 10K to balance accuracy vs performance
 */
export const DEFAULT_CFR_CONFIG: CFRConfig = {
  maxIterations: 1_000_000,
  targetExploitability: 0.1, // 0.1 mbb = 0.1% EV
  checkConvergenceEvery: 10_000,
};

/**
 * Applies regret matching to convert cumulative regrets into a strategy.
 *
 * Regret matching is the core of CFR: actions with higher (positive) regret
 * are played more frequently. Negative regrets are treated as zero.
 *
 * When all regrets are non-positive, returns uniform distribution to avoid
 * division by zero (critical for numerical stability).
 *
 * @param regretSum - Cumulative regrets per action (Float64Array)
 * @returns Probability distribution over actions (sums to 1.0)
 */
export function regretMatching(regretSum: Float64Array): number[] {
  const numActions = regretSum.length;

  // Sum positive regrets
  let positiveSum = 0;
  for (let i = 0; i < numActions; i++) {
    if (regretSum[i] > 0) {
      positiveSum += regretSum[i];
    }
  }

  // If no positive regrets, return uniform (avoid NaN)
  if (positiveSum <= 1e-9) {
    const uniform = 1 / numActions;
    return Array(numActions).fill(uniform);
  }

  // Normalize positive regrets to probability distribution
  const strategy: number[] = new Array(numActions);
  for (let i = 0; i < numActions; i++) {
    strategy[i] = regretSum[i] > 0 ? regretSum[i] / positiveSum : 0;
  }

  // Assertion: verify valid probability distribution
  const sum = strategy.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 1e-6) {
    throw new Error(`regretMatching produced invalid distribution: sum=${sum}`);
  }

  return strategy;
}

/**
 * Updates cumulative regrets for an InfoSet using CFR+.
 *
 * CFR+ improvement: After accumulating counterfactual regret, floor at 0.
 * This MUST happen AFTER accumulation, not before. The floor accelerates
 * convergence by preventing accumulation of negative regrets.
 *
 * Counterfactual regret = (action value - node value) * opponent reach probability
 *
 * @param infoSet - The InfoSet to update
 * @param actionValues - Expected values for each action
 * @param nodeValue - Expected value of the entire node (weighted by current strategy)
 * @param opponentReach - Product of opponent reach probabilities to this node
 */
export function updateRegrets(
  infoSet: InfoSet,
  actionValues: number[],
  nodeValue: number,
  opponentReach: number
): void {
  const { numActions, regretSum } = infoSet;

  if (actionValues.length !== numActions) {
    throw new Error(
      `Action values length (${actionValues.length}) doesn't match numActions (${numActions})`
    );
  }

  for (let i = 0; i < numActions; i++) {
    // Instant regret = how much better this action was than the weighted average
    const instantRegret = actionValues[i] - nodeValue;

    // Counterfactual regret = instant regret weighted by opponent's reach
    const counterfactualRegret = instantRegret * opponentReach;

    // Accumulate regret
    regretSum[i] += counterfactualRegret;

    // CFR+ FLOOR: clamp to 0 AFTER accumulation
    // This is the critical CFR+ improvement over vanilla CFR
    if (regretSum[i] < 0) {
      regretSum[i] = 0;
    }
  }
}

/**
 * Updates strategy sum for computing the average strategy.
 *
 * The average strategy over all iterations converges to Nash equilibrium.
 * Each iteration's strategy is weighted by the current player's reach probability.
 *
 * @param infoSet - The InfoSet to update
 * @param strategy - Current strategy (probability distribution)
 * @param currentReach - Current player's reach probability to this node
 */
export function updateStrategySum(
  infoSet: InfoSet,
  strategy: number[],
  currentReach: number
): void {
  const { numActions, strategySum } = infoSet;

  if (strategy.length !== numActions) {
    throw new Error(
      `Strategy length (${strategy.length}) doesn't match numActions (${numActions})`
    );
  }

  for (let i = 0; i < numActions; i++) {
    strategySum[i] += currentReach * strategy[i];
  }
}

/**
 * Validates that a strategy is a valid probability distribution.
 *
 * Throws a descriptive error if validation fails.
 *
 * @param strategy - The strategy to validate
 * @throws Error if strategy is invalid
 */
export function validateStrategy(strategy: number[]): void {
  if (!Array.isArray(strategy) || strategy.length === 0) {
    throw new Error('Strategy must be a non-empty array');
  }

  let sum = 0;
  for (let i = 0; i < strategy.length; i++) {
    const p = strategy[i];

    if (typeof p !== 'number' || Number.isNaN(p)) {
      throw new Error(`Strategy contains invalid value at index ${i}: ${p}`);
    }

    if (p < -1e-9) {
      throw new Error(`Strategy contains negative probability at index ${i}: ${p}`);
    }

    if (p > 1 + 1e-9) {
      throw new Error(`Strategy contains probability > 1 at index ${i}: ${p}`);
    }

    sum += p;
  }

  if (Math.abs(sum - 1.0) > 1e-6) {
    throw new Error(`Strategy probabilities sum to ${sum}, expected 1.0`);
  }
}
