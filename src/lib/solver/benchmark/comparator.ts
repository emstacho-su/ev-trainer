// src/lib/solver/benchmark/comparator.ts
// Reference solution loading and comparison utilities for benchmark validation.

import type { CanonicalHand } from '../types';
import { CANONICAL_HANDS } from '../abstraction/cards';
import preflopReference from './reference/preflop.json';
import postflopReference from './reference/postflop.json';

// ========================================
// Types
// ========================================

/**
 * Reference solution format as stored in JSON files.
 */
export interface ReferenceData {
  readonly version: string;
  readonly solver: string;
  readonly generated: string;
  readonly scenarios: Record<string, ReferenceScenarioData>;
}

/**
 * Reference data for a single scenario.
 */
export interface ReferenceScenarioData {
  readonly strategies: Record<string, Record<string, number>>;
  readonly ev: Record<string, number>;
}

/**
 * Parsed reference solution with typed Maps.
 */
export interface ReferenceSolution {
  readonly scenarioId: string;
  readonly strategies: Map<CanonicalHand, Map<string, number>>;
  readonly evs: Map<CanonicalHand, number>;
}

/**
 * Comparison result for a single hand.
 */
export interface HandComparison {
  readonly hand: CanonicalHand;
  readonly passed: boolean;
  readonly evDelta: number;
  readonly solverEv: number;
  readonly referenceEv: number;
  readonly strategyDelta: number; // Max action frequency difference
}

/**
 * Overall comparison result for a scenario.
 */
export interface ComparisonResult {
  readonly scenarioId: string;
  readonly passed: boolean;
  readonly maxEvDelta: number;
  readonly avgEvDelta: number;
  readonly worstHand: CanonicalHand;
  readonly handResults: Map<CanonicalHand, HandComparison>;
}

/**
 * Solver solution format expected by comparator.
 * This abstracts over PreflopSolution/PostflopSolution.
 */
export interface SolverSolution {
  /** Strategy per hand: hand -> action -> frequency */
  readonly strategies: Map<CanonicalHand, Map<string, number>>;
  /** Expected value per hand in BB */
  readonly evs: Map<CanonicalHand, number>;
}

// ========================================
// Reference Loading
// ========================================

/**
 * Loads reference solution data for a given scenario ID.
 *
 * @param scenarioId - Scenario ID to load (e.g., "preflop-rfi-btn")
 * @returns Parsed ReferenceSolution with typed Maps
 * @throws Error if scenario not found
 */
export function loadPioReference(scenarioId: string): ReferenceSolution {
  // Check preflop reference
  const preflopData = preflopReference as ReferenceData;
  if (preflopData.scenarios[scenarioId]) {
    return parseReferenceScenario(scenarioId, preflopData.scenarios[scenarioId]);
  }

  // Check postflop reference
  const postflopData = postflopReference as ReferenceData;
  if (postflopData.scenarios[scenarioId]) {
    return parseReferenceScenario(scenarioId, postflopData.scenarios[scenarioId]);
  }

  throw new Error(`Reference scenario not found: ${scenarioId}`);
}

/**
 * Parses raw reference scenario data into typed ReferenceSolution.
 */
function parseReferenceScenario(
  scenarioId: string,
  data: ReferenceScenarioData
): ReferenceSolution {
  const strategies = new Map<CanonicalHand, Map<string, number>>();
  const evs = new Map<CanonicalHand, number>();

  for (const [hand, actionFreqs] of Object.entries(data.strategies)) {
    const actionMap = new Map<string, number>();
    for (const [action, freq] of Object.entries(actionFreqs)) {
      actionMap.set(action, freq);
    }
    strategies.set(hand as CanonicalHand, actionMap);
  }

  for (const [hand, ev] of Object.entries(data.ev)) {
    evs.set(hand as CanonicalHand, ev);
  }

  return { scenarioId, strategies, evs };
}

/**
 * Lists all available reference scenario IDs.
 */
export function listReferenceScenarios(): string[] {
  const preflopData = preflopReference as ReferenceData;
  const postflopData = postflopReference as ReferenceData;

  return [
    ...Object.keys(preflopData.scenarios),
    ...Object.keys(postflopData.scenarios),
  ];
}

// ========================================
// Solution Comparison
// ========================================

/**
 * Compares solver output against reference solution.
 *
 * For each hand in the reference:
 * - Computes EV delta (absolute difference)
 * - Computes strategy delta (max action frequency difference)
 * - Determines if hand passes tolerance check
 *
 * @param solver - Solver solution to validate
 * @param reference - Reference solution from PioSolver
 * @param tolerance - EV tolerance in BB (default: 0.001 = 0.1%)
 * @returns ComparisonResult with detailed per-hand results
 */
export function compareSolutions(
  solver: SolverSolution,
  reference: ReferenceSolution,
  tolerance: number = 0.001
): ComparisonResult {
  const handResults = new Map<CanonicalHand, HandComparison>();
  let maxEvDelta = 0;
  let totalEvDelta = 0;
  let worstHand: CanonicalHand = 'AA';
  let handCount = 0;
  let allPassed = true;

  for (const [hand, refEv] of reference.evs) {
    const solverEv = solver.evs.get(hand);
    const refStrategy = reference.strategies.get(hand);
    const solverStrategy = solver.strategies.get(hand);

    // Handle missing solver data
    if (solverEv === undefined) {
      const comparison: HandComparison = {
        hand,
        passed: false,
        evDelta: Math.abs(refEv),
        solverEv: 0,
        referenceEv: refEv,
        strategyDelta: 1.0,
      };
      handResults.set(hand, comparison);
      maxEvDelta = Math.max(maxEvDelta, comparison.evDelta);
      totalEvDelta += comparison.evDelta;
      worstHand = hand;
      allPassed = false;
      handCount++;
      continue;
    }

    const evDelta = calculateEvDelta(solverEv, refEv);
    const strategyDelta = calculateStrategyDelta(solverStrategy, refStrategy);
    const passed = evDelta <= tolerance;

    const comparison: HandComparison = {
      hand,
      passed,
      evDelta,
      solverEv,
      referenceEv: refEv,
      strategyDelta,
    };

    handResults.set(hand, comparison);

    if (evDelta > maxEvDelta) {
      maxEvDelta = evDelta;
      worstHand = hand;
    }

    totalEvDelta += evDelta;
    handCount++;

    if (!passed) {
      allPassed = false;
    }
  }

  return {
    scenarioId: reference.scenarioId,
    passed: allPassed,
    maxEvDelta,
    avgEvDelta: handCount > 0 ? totalEvDelta / handCount : 0,
    worstHand,
    handResults,
  };
}

/**
 * Calculates EV delta between solver and reference.
 *
 * Handles edge cases:
 * - NaN values are treated as maximum error
 * - Infinity values are treated as maximum error
 *
 * @param solverEv - Solver's EV for the hand
 * @param referenceEv - Reference EV for the hand
 * @returns Absolute difference in BB
 */
export function calculateEvDelta(solverEv: number, referenceEv: number): number {
  // Handle invalid values
  if (Number.isNaN(solverEv) || Number.isNaN(referenceEv)) {
    return Number.MAX_VALUE;
  }

  if (!Number.isFinite(solverEv) || !Number.isFinite(referenceEv)) {
    return Number.MAX_VALUE;
  }

  return Math.abs(solverEv - referenceEv);
}

/**
 * Calculates maximum action frequency delta between strategies.
 */
function calculateStrategyDelta(
  solver: Map<string, number> | undefined,
  reference: Map<string, number> | undefined
): number {
  if (!solver || !reference) {
    return 1.0;
  }

  let maxDelta = 0;

  // Check all actions in reference
  for (const [action, refFreq] of reference) {
    const solverFreq = solver.get(action) ?? 0;
    const delta = Math.abs(solverFreq - refFreq);
    maxDelta = Math.max(maxDelta, delta);
  }

  // Check any extra actions in solver
  for (const [action, solverFreq] of solver) {
    if (!reference.has(action)) {
      maxDelta = Math.max(maxDelta, solverFreq);
    }
  }

  return maxDelta;
}

/**
 * Validates that reference solution data is well-formed.
 *
 * Checks:
 * - All hands have strategies summing to 1.0
 * - All hands have EV values
 * - EVs are in reasonable range
 *
 * @param reference - Reference solution to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateReferenceSolution(reference: ReferenceSolution): string[] {
  const errors: string[] = [];

  for (const [hand, strategy] of reference.strategies) {
    // Check frequencies sum to 1.0
    let sum = 0;
    for (const freq of strategy.values()) {
      sum += freq;
    }
    if (Math.abs(sum - 1.0) > 0.001) {
      errors.push(`${hand}: frequencies sum to ${sum.toFixed(4)}, expected 1.0`);
    }

    // Check EV exists
    if (!reference.evs.has(hand)) {
      errors.push(`${hand}: missing EV value`);
    }
  }

  // Check EV range
  for (const [hand, ev] of reference.evs) {
    if (ev < -10 || ev > 10) {
      errors.push(`${hand}: EV ${ev} outside reasonable range [-10, 10]`);
    }
  }

  return errors;
}

/**
 * Gets the expected hand count for a scenario.
 * Preflop scenarios should cover all 169 hands.
 */
export function getExpectedHandCount(scenarioId: string): number {
  if (scenarioId.startsWith('preflop-')) {
    return 169;
  }
  // Postflop scenarios may have fewer hands due to card removal
  return 0; // Variable for postflop
}
