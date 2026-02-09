// src/lib/solver/postflopSolver.ts
// CFR+ postflop solver with E[HS] bucketing and hand evaluation.

import type {
  CFRConfig,
  CFRResult,
  Player,
  GameNode,
  DecisionNode,
  TerminalNode,
  ChanceNode,
  Card,
  Hand,
  CanonicalHand,
  TreeConfig,
  ActionAbstractionConfig,
  PositionRelative,
} from './types';
import type { Street } from '../engine/types';
import type { SolverNodeOutput, SolverActionOutput } from '../engine/solverAdapter';
import { InfoSetStore, getAverageStrategy, getCurrentStrategy } from './infoSet';
import { regretMatching, updateRegrets, updateStrategySum, DEFAULT_CFR_CONFIG } from './cfr';
import {
  getPostflopBuckets,
  assignBucket,
  calculateEHS,
  buildPostflopInfoSetId,
  getValidHands,
  DEFAULT_POSTFLOP_BUCKETS,
  type PostflopBucket,
} from './abstraction/cards';
import { compareHands } from './evaluation/handRanking';
import { getAbstractedRaiseSizes, roundToBb } from './abstraction/actions';

/**
 * Configuration for postflop CFR+ solver.
 * Extends CFRConfig with postflop-specific parameters.
 */
export interface PostflopConfig extends CFRConfig {
  /** Current street (FLOP, TURN, or RIVER) */
  street: Street;
  /** Board cards (3-5 cards) */
  board: Card[];
  /** Hero's range arriving at this decision point */
  heroRange: CanonicalHand[];
  /** Villain's range arriving at this decision point */
  villainRange: CanonicalHand[];
  /** Current pot size in big blinds */
  potBb: number;
  /** Effective stack size in big blinds */
  stackBb: number;
  /** Hero's relative position */
  heroPosition: PositionRelative;
  /** Action abstraction configuration */
  actionAbstraction: ActionAbstractionConfig;
  /** Number of E[HS] buckets for abstraction (default 50) */
  numBuckets?: number;
}

/**
 * Solution output for postflop subgame solving.
 */
export interface PostflopSolution {
  /** Average strategies by info set ID */
  strategies: Map<string, number[]>;
  /** CFR training result with convergence info */
  result: CFRResult;
  /** Board cards used */
  board: Card[];
  /** Street solved */
  street: Street;
  /** Bucket definitions used */
  buckets: PostflopBucket[];
  /** Info set store with all training data */
  infoSets: InfoSetStore;
}

/**
 * Postflop action identifiers.
 */
export const POSTFLOP_ACTIONS = {
  FOLD: 'FOLD',
  CHECK: 'CHECK',
  CALL: 'CALL',
  BET_33: 'BET_33', // 33% pot
  BET_50: 'BET_50', // 50% pot
  BET_75: 'BET_75', // 75% pot
  BET_100: 'BET_100', // 100% pot (pot-sized)
  RAISE_2_2: 'RAISE_2.2',
  RAISE_2_5: 'RAISE_2.5',
  RAISE_3: 'RAISE_3',
  ALL_IN: 'ALL_IN',
} as const;

/**
 * Reach probabilities for CFR traversal.
 */
interface ReachProbs {
  /** Player 0 reach probability */
  p0: number;
  /** Player 1 reach probability */
  p1: number;
}

/**
 * Postflop game state tracking.
 */
interface PostflopGameState {
  /** Current pot size in BB */
  potBb: number;
  /** Stack sizes for [player0, player1] in BB */
  stacksBb: [number, number];
  /** Current amount each player has committed this street */
  committedBb: [number, number];
  /** Player who must act next (0 or 1) */
  actingPlayer: Player;
  /** Current bet amount to call (0 if no bet) */
  currentBetBb: number;
  /** Whether each player has acted at least once */
  hasActed: [boolean, boolean];
  /** Number of bets/raises this street */
  betCount: number;
}

// ========================================
// Game State Computation
// ========================================

/**
 * Computes postflop game state from action history.
 */
function computeGameState(
  history: readonly string[],
  config: PostflopConfig
): PostflopGameState {
  // OOP acts first postflop
  const oopPlayer: Player = config.heroPosition === 'OOP' ? 0 : 1;

  const state: PostflopGameState = {
    potBb: config.potBb,
    stacksBb: [config.stackBb, config.stackBb],
    committedBb: [0, 0],
    actingPlayer: oopPlayer,
    currentBetBb: 0,
    hasActed: [false, false],
    betCount: 0,
  };

  // Process action history
  for (const action of history) {
    const player = state.actingPlayer;

    if (action === 'FOLD') {
      state.hasActed[player] = true;
    } else if (action === 'CHECK') {
      state.hasActed[player] = true;
    } else if (action === 'CALL') {
      const callAmount = state.currentBetBb - state.committedBb[player];
      state.stacksBb[player] -= callAmount;
      state.potBb += callAmount;
      state.committedBb[player] = state.currentBetBb;
      state.hasActed[player] = true;
    } else if (action === 'ALL_IN') {
      const allinAmount = state.stacksBb[player];
      state.potBb += allinAmount;
      state.committedBb[player] += allinAmount;
      state.currentBetBb = Math.max(state.currentBetBb, state.committedBb[player]);
      state.stacksBb[player] = 0;
      state.hasActed[player] = true;
      state.betCount++;
    } else if (action.startsWith('BET_')) {
      // Parse bet size (e.g., "BET_50" -> 50% pot)
      const pctStr = action.substring(4);
      const pct = parseInt(pctStr) / 100;
      const betAmount = roundToBb(state.potBb * pct);
      const totalCommit = Math.min(betAmount, state.stacksBb[player]);

      state.stacksBb[player] -= totalCommit;
      state.potBb += totalCommit;
      state.committedBb[player] = totalCommit;
      state.currentBetBb = totalCommit;
      state.hasActed[player] = true;
      state.betCount++;
    } else if (action.startsWith('RAISE_')) {
      // Parse raise multiple (e.g., "RAISE_2.5" -> 2.5x)
      const multiple = parseFloat(action.substring(6));
      const raiseAmount = roundToBb(state.currentBetBb * multiple);
      const totalCommit = Math.min(raiseAmount, state.stacksBb[player]);
      const increment = totalCommit - state.committedBb[player];

      state.stacksBb[player] -= increment;
      state.potBb += increment;
      state.committedBb[player] = totalCommit;
      state.currentBetBb = totalCommit;
      state.hasActed[player] = true;
      state.betCount++;
    }

    // Alternate players
    state.actingPlayer = (1 - state.actingPlayer) as Player;
  }

  return state;
}

/**
 * Determines available actions at current decision point.
 */
function getAvailableActions(
  history: readonly string[],
  config: PostflopConfig
): string[] {
  const state = computeGameState(history, config);
  const player = state.actingPlayer;
  const actions: string[] = [];

  // Check if facing a bet
  const facingBet = state.currentBetBb > 0 && state.committedBb[player] < state.currentBetBb;

  if (facingBet) {
    // Facing bet: can fold, call, raise, or all-in
    actions.push('FOLD', 'CALL');

    // Add raises if stack allows
    const callAmount = state.currentBetBb - state.committedBb[player];
    const remainingStack = state.stacksBb[player];

    if (remainingStack > callAmount * 1.5) {
      actions.push('RAISE_2.2', 'RAISE_2.5', 'RAISE_3');
    }

    if (remainingStack > callAmount) {
      actions.push('ALL_IN');
    }
  } else {
    // Not facing bet: can check or bet
    actions.push('CHECK');

    const stack = state.stacksBb[player];
    if (stack > 0) {
      actions.push('BET_33', 'BET_50', 'BET_75', 'BET_100');
      actions.push('ALL_IN');
    }
  }

  return actions;
}

/**
 * Checks if history represents a terminal node.
 */
function isTerminal(history: readonly string[], config: PostflopConfig): boolean {
  if (history.length === 0) return false;

  const lastAction = history[history.length - 1];

  // Fold is always terminal
  if (lastAction === 'FOLD') return true;

  const state = computeGameState(history, config);

  // All-in is terminal (no more actions possible)
  if (state.stacksBb[0] === 0 || state.stacksBb[1] === 0) return true;

  // Check-check is terminal (showdown)
  if (history.length >= 2) {
    const prevAction = history[history.length - 2];
    if (lastAction === 'CHECK' && prevAction === 'CHECK') return true;
  }

  // Call after bet/raise is terminal (showdown)
  if (lastAction === 'CALL') return true;

  return false;
}

// ========================================
// Hand Evaluation and Equity
// ========================================

/**
 * Computes showdown utility at a terminal node.
 */
function computeShowdownUtility(
  hand0: Hand,
  hand1: Hand,
  board: Card[],
  potBb: number,
  forPlayer: Player
): number {
  // Compare hands
  const comparison = compareHands(hand0, hand1, board);

  let utility = 0;
  if (comparison === 1) {
    // Player 0 wins
    utility = forPlayer === 0 ? potBb / 2 : -potBb / 2;
  } else if (comparison === -1) {
    // Player 1 wins
    utility = forPlayer === 1 ? potBb / 2 : -potBb / 2;
  }
  // Tie: utility = 0 (both get money back)

  return utility;
}

/**
 * Computes utility at a terminal node.
 */
function computeTerminalValue(
  history: readonly string[],
  hand0: Hand,
  hand1: Hand,
  board: Card[],
  forPlayer: Player,
  config: PostflopConfig
): number {
  const lastAction = history[history.length - 1];
  const state = computeGameState(history, config);
  const totalPot = state.potBb;

  // Determine who acted last
  // After computing state, actingPlayer is the NEXT player to act
  // So last actor is (current - 1) mod 2
  const lastActingPlayer: Player = ((history.length - 1) % 2) as Player;

  if (lastAction === 'FOLD') {
    // Folder loses, opponent wins pot
    if (lastActingPlayer === forPlayer) {
      return -state.committedBb[forPlayer];
    } else {
      return state.committedBb[1 - forPlayer];
    }
  }

  // Showdown - evaluate hands
  return computeShowdownUtility(hand0, hand1, board, totalPot, forPlayer);
}

// ========================================
// CFR+ Core Algorithm
// ========================================

/**
 * Traverses the postflop game tree using CFR+.
 */
function cfrTraverse(
  history: string[],
  hand0: Hand,
  hand1: Hand,
  board: Card[],
  buckets: PostflopBucket[],
  reachProbs: ReachProbs,
  traversingPlayer: Player,
  store: InfoSetStore,
  config: PostflopConfig
): number {
  // Check terminal
  if (isTerminal(history, config)) {
    return computeTerminalValue(history, hand0, hand1, board, traversingPlayer, config);
  }

  // Get available actions
  const actions = getAvailableActions(history, config);
  if (actions.length === 0) {
    // Shouldn't happen if isTerminal is correct
    return 0;
  }

  // Determine acting player (alternates with history length)
  const oopPlayer: Player = config.heroPosition === 'OOP' ? 0 : 1;
  const ipPlayer: Player = (1 - oopPlayer) as Player;

  // First action is by OOP, then alternates
  const actingPlayer: Player = history.length === 0
    ? oopPlayer
    : (history.length % 2 === 0 ? oopPlayer : ipPlayer);

  // Get acting hand and compute E[HS]
  const actingHand = actingPlayer === 0 ? hand0 : hand1;
  const ehs = calculateEHS(actingHand, board, 200); // Use lower iterations for speed
  const bucketId = assignBucket(ehs, buckets);

  // Build info set ID
  const infoSetId = buildPostflopInfoSetId(actingPlayer, bucketId, board, history);
  const infoSet = store.getOrCreate(infoSetId, actions);

  // Get current strategy via regret matching
  const strategy = getCurrentStrategy(infoSet);

  // Compute action values
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
      hand0,
      hand1,
      board,
      buckets,
      newReach,
      traversingPlayer,
      store,
      config
    );

    actionValues[i] = childValue;
    nodeValue += strategy[i] * actionValues[i];
  }

  // Update regrets for traversing player at their decision nodes
  if (actingPlayer === traversingPlayer) {
    const opponentReach = traversingPlayer === 0 ? reachProbs.p1 : reachProbs.p0;
    updateRegrets(infoSet, actionValues, nodeValue, opponentReach);
  }

  // Update strategy sum
  const currentReach = actingPlayer === 0 ? reachProbs.p0 : reachProbs.p1;
  updateStrategySum(infoSet, strategy, currentReach);

  return nodeValue;
}

/**
 * Runs one full CFR iteration for postflop.
 */
function runCFRIteration(
  store: InfoSetStore,
  buckets: PostflopBucket[],
  config: PostflopConfig
): void {
  // Sample hands from ranges
  const validHands = getValidHands(config.board);

  // Sample subset for efficiency
  const handsSample = sampleHands(validHands, 20);

  for (const traversingPlayer of [0, 1] as Player[]) {
    for (const hand0 of handsSample) {
      for (const hand1 of handsSample) {
        // Skip if hands share cards
        if (handsOverlap(hand0, hand1, config.board)) continue;

        const reachProbs: ReachProbs = { p0: 1.0, p1: 1.0 };

        cfrTraverse(
          [],
          hand0,
          hand1,
          config.board,
          buckets,
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
 * Checks if hands or board share cards.
 */
function handsOverlap(hand0: Hand, hand1: Hand, board: Card[]): boolean {
  const allCards = new Set([...hand0, ...hand1, ...board]);
  return allCards.size !== (hand0.length + hand1.length + board.length);
}

/**
 * Samples a subset of hands for efficient iteration.
 */
function sampleHands(hands: Hand[], count: number): Hand[] {
  if (hands.length <= count) {
    return [...hands];
  }

  // Deterministic sampling
  const step = hands.length / count;
  const sampled: Hand[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(i * step);
    sampled.push(hands[idx]);
  }
  return sampled;
}

/**
 * Computes exploitability metric (simplified).
 */
function computeExploitability(store: InfoSetStore): number {
  let totalRegret = 0;
  let infoSetCount = 0;

  for (const [_, infoSet] of Array.from(store.entries())) {
    for (let i = 0; i < infoSet.numActions; i++) {
      totalRegret += Math.max(0, infoSet.regretSum[i]);
    }
    infoSetCount++;
  }

  if (infoSetCount === 0) return Infinity;

  const avgRegret = totalRegret / infoSetCount;
  return avgRegret * 1000; // Convert to mbb
}

// ========================================
// Main Solver Entry Point
// ========================================

/**
 * Solves a postflop subgame using CFR+ with E[HS] bucketing.
 *
 * @param config - Postflop solver configuration
 * @returns PostflopSolution with strategies and convergence info
 */
export function solvePostflopSubgame(config: PostflopConfig): PostflopSolution {
  if (config.board.length < 3) {
    throw new Error(`Postflop solver requires at least 3 board cards (flop), got ${config.board.length}`);
  }

  if (config.board.length > 5) {
    throw new Error(`Board cannot have more than 5 cards, got ${config.board.length}`);
  }

  // Initialize buckets
  const numBuckets = config.numBuckets || DEFAULT_POSTFLOP_BUCKETS;
  const buckets = getPostflopBuckets(numBuckets);

  const store = new InfoSetStore();
  const startTime = Date.now();

  let iteration = 0;
  let exploitability = Infinity;
  let converged = false;

  // Run CFR iterations
  while (iteration < config.maxIterations && !converged) {
    runCFRIteration(store, buckets, config);
    iteration++;

    // Check convergence periodically
    if (iteration % config.checkConvergenceEvery === 0) {
      exploitability = computeExploitability(store);

      if (config.progressCallback) {
        config.progressCallback(iteration, exploitability);
      }

      if (exploitability <= config.targetExploitability) {
        converged = true;
      }
    }
  }

  // Final exploitability check
  if (!converged) {
    exploitability = computeExploitability(store);
  }

  // Extract average strategies
  const strategies = new Map<string, number[]>();
  for (const [id, infoSet] of Array.from(store.entries())) {
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
    board: config.board,
    street: config.street,
    buckets,
    infoSets: store,
  };
}

/**
 * Converts postflop solution to SolverNodeOutput format.
 *
 * @param hand - Specific hand to get strategy for
 * @param board - Board cards
 * @param solution - Postflop solution
 * @param history - Action history
 * @returns SolverNodeOutput for the hand at this decision point
 */
export function toSolverNodeOutputPostflop(
  hand: Hand,
  board: Card[],
  solution: PostflopSolution,
  history: readonly string[] = []
): SolverNodeOutput {
  // Compute E[HS] for hand
  const ehs = calculateEHS(hand, board, 200);
  const bucketId = assignBucket(ehs, solution.buckets);

  // Determine player (this requires context - default to player 0)
  const player: Player = 0;

  // Build info set ID
  const infoSetId = buildPostflopInfoSetId(player, bucketId, board, history);

  const strategy = solution.strategies.get(infoSetId);

  if (!strategy) {
    return {
      nodeId: infoSetId,
      actions: [],
      status: 'unsolved',
      units: 'bb',
    };
  }

  // Get action names
  const infoSet = solution.infoSets.get(infoSetId);
  if (!infoSet) {
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
        actionId: infoSet.actions[i],
        frequency: strategy[i],
        ev: 0, // EV calculation would require additional work
      });
    }
  }

  // Normalize frequencies
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
 * Creates a postflop tree root node (chance node if cards remain to deal).
 * This is a placeholder for future full tree generation.
 */
export function createPostflopTree(config: PostflopConfig): ChanceNode {
  // For now, return a minimal chance node structure
  // Full implementation would generate all possible runouts

  const boardStr = config.board.join('');

  return {
    nodeType: 'CHANCE',
    nodeId: `POSTFLOP_${config.street}_${boardStr}`,
    depth: 0,
    history: [],
    outcomes: [], // Would contain all possible next cards
    probabilities: [],
    getChild: () => {
      throw new Error('Postflop tree generation not fully implemented');
    },
  };
}
