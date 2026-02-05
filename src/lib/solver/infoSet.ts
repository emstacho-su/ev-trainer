// src/lib/solver/infoSet.ts
// InfoSet storage and retrieval for CFR algorithm.

import type { InfoSet } from './types';

/**
 * Creates a new InfoSet with zero-initialized arrays.
 *
 * @param infoSetId - Unique identifier for this information set
 * @param actions - Array of action identifiers available at this decision point
 * @returns A new InfoSet ready for CFR training
 */
export function createInfoSet(infoSetId: string, actions: readonly string[]): InfoSet {
  const numActions = actions.length;
  return {
    infoSetId,
    numActions,
    regretSum: new Float64Array(numActions),
    strategySum: new Float64Array(numActions),
    actions,
  };
}

/**
 * Computes the average strategy from an InfoSet's accumulated strategy sums.
 *
 * The average strategy converges to Nash equilibrium as CFR iterations increase.
 * When no training data exists (all zeros), returns uniform distribution.
 *
 * @param infoSet - The InfoSet to compute average strategy for
 * @returns Probability distribution over actions (sums to 1.0)
 */
export function getAverageStrategy(infoSet: InfoSet): number[] {
  const { numActions, strategySum } = infoSet;

  // Sum all strategy weights
  let sum = 0;
  for (let i = 0; i < numActions; i++) {
    sum += strategySum[i];
  }

  // If no accumulated strategy, return uniform
  if (sum <= 1e-9) {
    const uniform = 1 / numActions;
    return Array(numActions).fill(uniform);
  }

  // Normalize to probability distribution
  const strategy: number[] = new Array(numActions);
  for (let i = 0; i < numActions; i++) {
    strategy[i] = strategySum[i] / sum;
  }

  return strategy;
}

/**
 * Computes the current strategy via regret matching.
 *
 * This is used during CFR iterations to determine action probabilities.
 * Positive regrets are normalized; negative regrets are treated as zero.
 * When all regrets are non-positive, returns uniform distribution.
 *
 * @param infoSet - The InfoSet to compute current strategy for
 * @returns Probability distribution over actions (sums to 1.0)
 */
export function getCurrentStrategy(infoSet: InfoSet): number[] {
  const { numActions, regretSum } = infoSet;

  // Sum positive regrets
  let positiveSum = 0;
  for (let i = 0; i < numActions; i++) {
    if (regretSum[i] > 0) {
      positiveSum += regretSum[i];
    }
  }

  // If no positive regrets, return uniform
  if (positiveSum <= 1e-9) {
    const uniform = 1 / numActions;
    return Array(numActions).fill(uniform);
  }

  // Normalize positive regrets to probability distribution
  const strategy: number[] = new Array(numActions);
  for (let i = 0; i < numActions; i++) {
    strategy[i] = regretSum[i] > 0 ? regretSum[i] / positiveSum : 0;
  }

  return strategy;
}

/**
 * Storage class for managing InfoSets during CFR training.
 *
 * Provides efficient storage and retrieval of InfoSets by their unique identifiers.
 * Uses Map for O(1) lookup performance with large info set counts.
 */
export class InfoSetStore {
  private readonly store: Map<string, InfoSet>;

  constructor() {
    this.store = new Map();
  }

  /**
   * Gets an existing InfoSet or creates a new one if it doesn't exist.
   *
   * @param infoSetId - Unique identifier for the information set
   * @param actions - Array of action identifiers (required for creation)
   * @returns The existing or newly created InfoSet
   */
  getOrCreate(infoSetId: string, actions: readonly string[]): InfoSet {
    let infoSet = this.store.get(infoSetId);
    if (!infoSet) {
      infoSet = createInfoSet(infoSetId, actions);
      this.store.set(infoSetId, infoSet);
    }
    return infoSet;
  }

  /**
   * Checks if an InfoSet exists in the store.
   *
   * @param infoSetId - The identifier to check
   * @returns true if the InfoSet exists
   */
  has(infoSetId: string): boolean {
    return this.store.has(infoSetId);
  }

  /**
   * Gets an existing InfoSet by identifier.
   *
   * @param infoSetId - The identifier to look up
   * @returns The InfoSet
   * @throws Error if the InfoSet doesn't exist
   */
  get(infoSetId: string): InfoSet {
    const infoSet = this.store.get(infoSetId);
    if (!infoSet) {
      throw new Error(`InfoSet not found: ${infoSetId}`);
    }
    return infoSet;
  }

  /**
   * Gets the average strategy for an InfoSet.
   * Convenience method that combines get() and getAverageStrategy().
   *
   * @param infoSetId - The identifier to look up
   * @returns Probability distribution over actions
   * @throws Error if the InfoSet doesn't exist
   */
  getAverageStrategy(infoSetId: string): number[] {
    return getAverageStrategy(this.get(infoSetId));
  }

  /**
   * Gets the current strategy for an InfoSet via regret matching.
   * Convenience method that combines get() and getCurrentStrategy().
   *
   * @param infoSetId - The identifier to look up
   * @returns Probability distribution over actions
   * @throws Error if the InfoSet doesn't exist
   */
  getCurrentStrategy(infoSetId: string): number[] {
    return getCurrentStrategy(this.get(infoSetId));
  }

  /**
   * Returns the number of InfoSets stored.
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Returns an iterator over all [infoSetId, InfoSet] pairs.
   */
  entries(): IterableIterator<[string, InfoSet]> {
    return this.store.entries();
  }

  /**
   * Clears all stored InfoSets.
   * Useful for resetting training state.
   */
  clear(): void {
    this.store.clear();
  }
}
