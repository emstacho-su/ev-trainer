// src/lib/solver/preflopSolver.ts
// CFR+ preflop solver implementation.

import type {
  CFRConfig,
  CFRResult,
  Player,
  GameNode,
  DecisionNode,
  TerminalNode,
  ChanceNode,
  PreflopTreeConfig,
  CanonicalHand,
  Hand,
} from './types';
import type { SolverNodeOutput, SolverActionOutput, SolverRequest } from '../engine/solverAdapter';
import { InfoSetStore, getAverageStrategy, getCurrentStrategy, createInfoSet } from './infoSet';
import { regretMatching, updateRegrets, updateStrategySum, DEFAULT_CFR_CONFIG } from './cfr';
import {
  createPreflopTree,
  createDecisionNode,
  isTerminal,
  getAvailableActions,
  buildInfoSetId,
  getNextPlayer,
  PREFLOP_ACTIONS,
  getValidVillainHands,
  countUnblockedCombos,
} from './gameTree';
import { CANONICAL_HANDS, getAllCombosForCanonical } from './abstraction/cards';
import {
  calculatePreflopEquityMonteCarlo,
  calculatePreflopEquityFromTable,
  isEquityTableLoaded,
} from './evaluation';

/**
 * Configuration for preflop CFR+ solver.
 * Extends CFRConfig with tree configuration and equity options.
 */
export interface PreflopSolverConfig extends CFRConfig {
  /** Game tree configuration */
  treeConfig: PreflopTreeConfig;
  /** Whether to use precomputed equity table (faster) */
  usePrecomputedEquity: boolean;
  /** Path to precomputed equity table file */
  equityTablePath?: string;
}

/**
 * Result of solving a preflop scenario.
 */
export interface PreflopSolution {
  /** Average strategies by info set ID */
  strategies: Map<string, number[]>;
  /** CFR training result with convergence info */
  result: CFRResult;
  /** Info set store with all training data */
  infoSets: InfoSetStore;
  /** Tree configuration used */
  config: PreflopSolverConfig;
}

/**
 * Progress update during solving.
 */
export interface SolverProgress {
  /** Current iteration number */
  iteration: number;
  /** Current exploitability in mbb/game */
  exploitability: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Number of info sets created */
  infoSetCount: number;
}

/**
 * Reach probabilities for CFR traversal.
 */
interface ReachProbs {
  /** Player 0 (SB) reach probability */
  p0: number;
  /** Player 1 (BB) reach probability */
  p1: number;
}

// ========================================
// CFR+ Core Algorithm
// ========================================

/**
 * Computes terminal utility for a showdown.
 *
 * @param heroHand - Hero's canonical hand
 * @param villainHand - Villain's canonical hand
 * @param potBb - Total pot size in BB
 * @param useTable - Whether to use precomputed equity table
 * @returns Expected utility for hero (player 0)
 */
function computeShowdownUtility(
  heroHand: CanonicalHand,
  villainHand: CanonicalHand,
  potBb: number,
  useTable: boolean
): number {
  // Get equity for hero
  let equity: number;

  if (useTable && isEquityTableLoaded()) {
    equity = calculatePreflopEquityFromTable(heroHand, villainHand);
  } else {
    // Use simplified strength comparison for speed during solving
    // Real equity calculation is too slow for CFR iterations
    equity = getSimplifiedEquity(heroHand, villainHand);
  }

  // Utility = equity * pot - (1 - equity) * pot = (2 * equity - 1) * pot
  // But we need to account for what hero has already put in
  // For simplicity: utility = equity * pot (hero wins pot) - cost already paid
  // Since costs are symmetric preflop, we use: (equity - 0.5) * pot * 2
  // Which gives: wins = +pot/2, losses = -pot/2, EV = 0 for 50% equity
  return (equity - 0.5) * potBb * 2;
}

/**
 * Simplified equity estimation for CFR iterations.
 * Uses precomputed hand strength rankings.
 */
function getSimplifiedEquity(hand1: CanonicalHand, hand2: CanonicalHand): number {
  const strength1 = getHandStrengthRank(hand1);
  const strength2 = getHandStrengthRank(hand2);

  if (strength1 === strength2) {
    return 0.5;
  }

  // Use sigmoid-like function for more realistic equity
  const diff = strength1 - strength2;
  // Typical hand strength difference of 50 rank points = ~65% equity
  const k = 0.03; // Steepness
  return 1 / (1 + Math.exp(-k * diff));
}

/**
 * Gets a numeric strength rank for a canonical hand.
 * Higher = stronger.
 */
function getHandStrengthRank(hand: CanonicalHand): number {
  // Premium pairs: AA=1000, KK=950, QQ=900, JJ=850, TT=800
  // Medium pairs: 99-55 = 750-450 (50 each)
  // Small pairs: 44-22 = 400-200 (100 each)
  // Premium suited: AKs=700, AQs=650, AJs=620, KQs=600
  // Premium offsuit: AKo=550, AQo=500, KQo=450
  // Suited connectors: bonus
  // This is a rough approximation; real equity tables are better

  const ranks = 'AKQJT98765432';

  if (hand.length === 2) {
    // Pair
    const rankIdx = ranks.indexOf(hand[0]);
    return 1000 - rankIdx * 60;
  }

  const highRankIdx = ranks.indexOf(hand[0]);
  const lowRankIdx = ranks.indexOf(hand[1]);
  const isSuited = hand[2] === 's';
  const gap = lowRankIdx - highRankIdx;

  // Base value from high card
  let strength = (12 - highRankIdx) * 40;

  // Bonus for kicker
  strength += (12 - lowRankIdx) * 10;

  // Suited bonus
  if (isSuited) {
    strength += 30;
  }

  // Connector bonus (for straight potential)
  if (gap <= 3) {
    strength += (4 - gap) * 10;
  }

  return strength;
}

/**
 * Traverses the game tree using CFR+ algorithm.
 *
 * @param history - Current action sequence
 * @param heroHand - Hero's canonical hand
 * @param villainHand - Villain's canonical hand
 * @param reachProbs - Current reach probabilities
 * @param traversingPlayer - Player we're computing regrets for
 * @param store - InfoSet storage
 * @param config - Solver configuration
 * @returns Expected utility for traversing player
 */
function cfrTraverse(
  history: string[],
  heroHand: CanonicalHand,
  villainHand: CanonicalHand,
  reachProbs: ReachProbs,
  traversingPlayer: Player,
  store: InfoSetStore,
  config: PreflopSolverConfig
): number {
  // Check terminal
  if (isTerminal(history, config.treeConfig)) {
    return computeTerminalValue(
      history,
      heroHand,
      villainHand,
      traversingPlayer,
      config
    );
  }

  // Determine acting player from history
  // Player 0 (SB) acts first, then alternates
  const actingPlayer: Player = (history.length % 2) as Player;

  // Get available actions
  const actions = getAvailableActions(history, config.treeConfig);
  if (actions.length === 0) {
    // No actions = terminal-like (shouldn't happen if isTerminal works correctly)
    return 0;
  }

  // Get current player's hand
  const actingHand = actingPlayer === 0 ? heroHand : villainHand;

  // Build info set ID and get/create info set
  const infoSetId = buildInfoSetId(actingPlayer, actingHand, history);
  const infoSet = store.getOrCreate(infoSetId, actions);

  // Get current strategy via regret matching
  const strategy = getCurrentStrategy(infoSet);

  // Compute action values by recursion
  const actionValues: number[] = new Array(actions.length);
  let nodeValue = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const newHistory = [...history, action];

    // Update reach probabilities
    const newReach: ReachProbs = { ...reachProbs };
    if (actingPlayer === 0) {
      newReach.p0 *= strategy[i];
    } else {
      newReach.p1 *= strategy[i];
    }

    // Recurse
    const childValue = cfrTraverse(
      newHistory,
      heroHand,
      villainHand,
      newReach,
      traversingPlayer,
      store,
      config
    );

    // Store action value (negate for opponent perspective if needed)
    if (actingPlayer === traversingPlayer) {
      actionValues[i] = childValue;
    } else {
      // From acting player's perspective, child value is already correct
      // because we're always returning value for traversing player
      actionValues[i] = childValue;
    }

    nodeValue += strategy[i] * actionValues[i];
  }

  // Update regrets only for traversing player at their decision nodes
  if (actingPlayer === traversingPlayer) {
    const opponentReach = traversingPlayer === 0 ? reachProbs.p1 : reachProbs.p0;
    updateRegrets(infoSet, actionValues, nodeValue, opponentReach);
  }

  // Always update strategy sum (weighted by current player's reach)
  const currentReach = actingPlayer === 0 ? reachProbs.p0 : reachProbs.p1;
  updateStrategySum(infoSet, strategy, currentReach);

  return nodeValue;
}

/**
 * Computes utility at a terminal node.
 */
function computeTerminalValue(
  history: string[],
  heroHand: CanonicalHand,
  villainHand: CanonicalHand,
  forPlayer: Player,
  config: PreflopSolverConfig
): number {
  const lastAction = history[history.length - 1];

  // Determine who folded (if anyone)
  // The player who took the last action
  const lastActingPlayer: Player = ((history.length - 1) % 2) as Player;

  if (lastAction === PREFLOP_ACTIONS.FOLD) {
    // Folder loses their committed amount
    // Winner (opponent) wins it
    const potContributions = computePotContributions(history, config.treeConfig);

    if (lastActingPlayer === forPlayer) {
      // We folded, we lose our contribution
      return -potContributions[forPlayer];
    } else {
      // Opponent folded, we win their contribution
      return potContributions[1 - forPlayer];
    }
  }

  // Showdown - compute equity-based utility
  const potContributions = computePotContributions(history, config.treeConfig);
  const totalPot = potContributions[0] + potContributions[1];

  // Get hands in correct order (player 0 = hero, player 1 = villain)
  const hand0 = heroHand;
  const hand1 = villainHand;

  // Compute equity for player 0 (hero)
  const heroEquity = computeShowdownUtility(hand0, hand1, totalPot, config.usePrecomputedEquity);

  // Convert to utility for forPlayer
  // heroEquity is for player 0, so negate for player 1
  if (forPlayer === 0) {
    return heroEquity;
  } else {
    return -heroEquity;
  }
}

/**
 * Computes how much each player has contributed to the pot.
 */
function computePotContributions(
  history: string[],
  config: PreflopTreeConfig
): [number, number] {
  let committed: [number, number] = [config.smallBlindBb, config.bigBlindBb];
  let currentBet = config.bigBlindBb;

  for (let i = 0; i < history.length; i++) {
    const action = history[i];
    const player: Player = (i % 2) as Player;

    if (action === PREFLOP_ACTIONS.CALL) {
      committed[player] = currentBet;
    } else if (action === PREFLOP_ACTIONS.ALL_IN) {
      const stack = config.startingStackBb;
      committed[player] = stack;
      currentBet = Math.max(currentBet, stack);
    } else if (action.startsWith('RAISE_')) {
      const multiple = parseFloat(action.substring(6));
      const newBet = currentBet * multiple;
      committed[player] = Math.min(newBet, config.startingStackBb);
      currentBet = committed[player];
    }
  }

  return committed;
}

/**
 * Runs one full CFR iteration.
 *
 * @param store - InfoSet storage
 * @param config - Solver configuration
 */
function runCFRIteration(
  store: InfoSetStore,
  config: PreflopSolverConfig
): void {
  // For each canonical hand hero could have
  // And each canonical villain hand (weighted by combo count)
  // Run CFR traversal

  // For efficiency, we sample a subset of hand matchups
  // Full enumeration would be 169 * 169 = 28,561 matchups

  // Alternating updates: traverse for player 0, then player 1
  for (const traversingPlayer of [0, 1] as Player[]) {
    // Sample a subset of hands for speed
    const handsSample = sampleHands(CANONICAL_HANDS, 20);

    for (const heroHand of handsSample) {
      // Get valid villain hands (considering blockers)
      const villainHands = getValidVillainHands(heroHand);
      const villainSample = sampleHands(villainHands, 10);

      for (const villainHand of villainSample) {
        // Weight by number of unblocked combos
        const comboWeight = countUnblockedCombos(heroHand, villainHand);
        if (comboWeight === 0) continue;

        // Initial reach probs (could incorporate combo weights here)
        const reachProbs: ReachProbs = { p0: 1.0, p1: 1.0 };

        cfrTraverse(
          [],
          heroHand,
          villainHand,
          reachProbs,
          traversingPlayer,
          store,
          config
        );
      }
    }
  }
}

/**
 * Samples a subset of hands for efficient iteration.
 */
function sampleHands(hands: readonly CanonicalHand[], count: number): CanonicalHand[] {
  if (hands.length <= count) {
    return [...hands];
  }

  // Deterministic sampling for reproducibility
  const step = hands.length / count;
  const sampled: CanonicalHand[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(i * step);
    sampled.push(hands[idx]);
  }
  return sampled;
}

// ========================================
// Main Solver Entry Point
// ========================================

/**
 * Solves a preflop scenario using CFR+.
 *
 * @param config - Solver configuration
 * @returns Solution with strategies, result, and info sets
 */
export function solvePreflopScenario(config: PreflopSolverConfig): PreflopSolution {
  const store = new InfoSetStore();
  const startTime = Date.now();

  let iteration = 0;
  let exploitability = Infinity;
  let converged = false;

  // Run CFR iterations
  while (iteration < config.maxIterations && !converged) {
    runCFRIteration(store, config);
    iteration++;

    // Check convergence periodically
    if (iteration % config.checkConvergenceEvery === 0) {
      exploitability = computeExploitability(store, config);

      // Progress callback
      if (config.progressCallback) {
        config.progressCallback(iteration, exploitability);
      }

      // Check convergence
      if (exploitability <= config.targetExploitability) {
        converged = true;
      }
    }
  }

  // Final exploitability check
  if (!converged) {
    exploitability = computeExploitability(store, config);
  }

  // Extract average strategies
  const strategies = new Map<string, number[]>();
  for (const [id, infoSet] of store.entries()) {
    strategies.set(id, getAverageStrategy(infoSet));
  }

  const result: CFRResult = {
    converged,
    iterations: iteration,
    exploitability,
    elapsedMs: Date.now() - startTime,
  };

  return {
    strategies,
    result,
    infoSets: store,
    config,
  };
}

// ========================================
// Exploitability Calculation
// ========================================

/**
 * Computes exploitability of current solution.
 *
 * Exploitability = sum of best response values for each player.
 * A Nash equilibrium has exploitability = 0.
 *
 * For preflop, we compute a simplified exploitability metric.
 *
 * @param store - InfoSet storage
 * @param config - Solver configuration
 * @returns Exploitability in mbb/game
 */
export function computeExploitability(
  store: InfoSetStore,
  config: PreflopSolverConfig
): number {
  // Simplified exploitability: sum of regrets indicates room for improvement
  // True exploitability requires full best-response calculation

  let totalRegret = 0;
  let infoSetCount = 0;

  for (const [_, infoSet] of store.entries()) {
    // Sum positive regrets (how much we could improve)
    for (let i = 0; i < infoSet.numActions; i++) {
      totalRegret += Math.max(0, infoSet.regretSum[i]);
    }
    infoSetCount++;
  }

  if (infoSetCount === 0) {
    return Infinity;
  }

  // Normalize by info set count and convert to mbb
  // This is an approximation; true exploitability needs best response
  const avgRegret = totalRegret / infoSetCount;

  // Scale to mbb/game (1 BB = 1000 mbb)
  return avgRegret * 1000;
}

// ========================================
// Output Conversion
// ========================================

/**
 * Converts internal solution to SolverNodeOutput format.
 *
 * @param infoSetId - Info set to convert
 * @param solution - Solution containing strategies
 * @returns SolverNodeOutput for the info set
 */
export function toSolverNodeOutput(
  infoSetId: string,
  solution: PreflopSolution
): SolverNodeOutput {
  const strategy = solution.strategies.get(infoSetId);

  if (!strategy) {
    return {
      nodeId: infoSetId,
      actions: [],
      status: 'unsolved',
      units: 'bb',
    };
  }

  // Get the info set to access action names
  let actionNames: readonly string[];
  if (solution.infoSets.has(infoSetId)) {
    actionNames = solution.infoSets.get(infoSetId).actions;
  } else {
    // Fallback: infer actions from strategy length
    // This shouldn't happen if infoSetId is valid
    return {
      nodeId: infoSetId,
      actions: [],
      status: 'error',
      units: 'bb',
    };
  }

  // Build action outputs
  const actions: SolverActionOutput[] = [];
  for (let i = 0; i < strategy.length; i++) {
    if (strategy[i] > 0) {
      actions.push({
        actionId: actionNames[i],
        frequency: strategy[i],
        ev: 0, // EV calculation would require additional work
      });
    }
  }

  // Normalize frequencies to ensure they sum to 1.0
  const freqSum = actions.reduce((sum, a) => sum + a.frequency, 0);
  if (freqSum > 0 && Math.abs(freqSum - 1.0) > 1e-6) {
    for (const action of actions) {
      action.frequency /= freqSum;
    }
  }

  return {
    nodeId: infoSetId,
    actions,
    status: solution.result.converged ? 'ok' : 'unsolved',
    units: 'bb',
    exploitability: solution.result.exploitability,
  };
}

/**
 * Gets solver output for a specific request.
 *
 * @param request - Solver request with game state
 * @param solution - Preflop solution
 * @returns SolverNodeOutput for the request
 */
export function getSolverOutput(
  request: SolverRequest,
  solution: PreflopSolution
): SolverNodeOutput {
  // Build info set ID from request
  // Request contains: publicState, history, toAct, rangeContext

  // Extract canonical hand from rangeContext (if provided)
  const hand = request.rangeContext || 'AA'; // Default for testing

  // Map position to player index
  const player: Player = request.toAct === 'SB' ? 0 : 1;

  // Build history from request
  const history = request.history.actions;

  const infoSetId = buildInfoSetId(player, hand, history);

  return toSolverNodeOutput(infoSetId, solution);
}

/**
 * Default solver configuration for quick tests.
 */
export function createDefaultSolverConfig(
  treeConfig: PreflopTreeConfig
): PreflopSolverConfig {
  return {
    ...DEFAULT_CFR_CONFIG,
    treeConfig,
    usePrecomputedEquity: false,
  };
}
