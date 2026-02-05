// src/lib/solver/gameTree.ts
// Game tree builder with lazy node generation for preflop decision trees.
// Full NLHE trees have 10^17+ nodes - lazy generation only creates nodes as visited.

import type {
  CanonicalHand,
  DecisionNode,
  ChanceNode,
  TerminalNode,
  GameNode,
  Player,
  TreeConfig,
  PreflopTreeConfig,
} from './types';
import { canonicalizePreflop, CANONICAL_HANDS, getAllCombosForCanonical } from './abstraction/cards';
import { getAbstractedRaiseSizes, roundToBb } from './abstraction/actions';

// ========================================
// Standard Preflop Action IDs
// ========================================

/**
 * Standardized action identifiers for preflop play.
 * Using string IDs enables deterministic sorting and consistent info set keys.
 */
export const PREFLOP_ACTIONS = {
  FOLD: 'FOLD',
  CHECK: 'CHECK',
  CALL: 'CALL',
  RAISE_2_2: 'RAISE_2.2',
  RAISE_2_5: 'RAISE_2.5',
  RAISE_3: 'RAISE_3',
  ALL_IN: 'ALL_IN',
} as const;

// ========================================
// ID Builders
// ========================================

/**
 * Builds a unique identifier for an information set.
 * The info set ID is used as the key for regret/strategy storage in CFR.
 *
 * Format: {player}:{canonicalHand}:{history}
 * Example: "0:AKs:CALL,RAISE_2.5"
 *
 * @param player - Player index (0 or 1)
 * @param hand - Canonical hand representation
 * @param history - Action sequence to reach this decision point
 * @returns Unique info set identifier
 */
export function buildInfoSetId(player: Player, hand: CanonicalHand, history: readonly string[]): string {
  const historyStr = history.length > 0 ? history.join(',') : '';
  return `${player}:${hand}:${historyStr}`;
}

/**
 * Builds a unique identifier for a game tree node.
 * Used for caching and debugging. Different from info set ID because
 * node ID doesn't include player's hand (public information only).
 *
 * @param history - Action sequence to reach this node
 * @returns Unique node identifier
 */
export function buildNodeId(history: readonly string[]): string {
  return history.length > 0 ? history.join(',') : 'ROOT';
}

// ========================================
// Game State Tracking
// ========================================

/**
 * Internal game state for preflop play.
 * Tracks pot size, stacks, and acting player throughout the action sequence.
 */
interface PreflopGameState {
  /** Current pot size in BB */
  potBb: number;
  /** Stack sizes for [player0, player1] in BB */
  stacksBb: [number, number];
  /** Current amount each player has committed to pot */
  committedBb: [number, number];
  /** Player who must act next (0 or 1) */
  actingPlayer: Player;
  /** Current bet amount to call (0 if no bet to call) */
  currentBetBb: number;
  /** Whether each player has acted at least once */
  hasActed: [boolean, boolean];
  /** Number of raises this street */
  raiseCount: number;
}

/**
 * Computes game state after processing an action sequence.
 *
 * @param history - Action sequence from game start
 * @param config - Tree configuration
 * @returns Current game state
 */
function computeGameState(history: readonly string[], config: TreeConfig): PreflopGameState {
  // Initialize state with blinds posted
  // Player 0 = SB (small blind), Player 1 = BB (big blind)
  const state: PreflopGameState = {
    potBb: config.smallBlindBb + config.bigBlindBb,
    stacksBb: [
      config.startingStackBb - config.smallBlindBb,
      config.startingStackBb - config.bigBlindBb,
    ],
    committedBb: [config.smallBlindBb, config.bigBlindBb],
    actingPlayer: 0, // SB acts first preflop
    currentBetBb: config.bigBlindBb,
    hasActed: [false, false],
    raiseCount: 0,
  };

  // Process each action in history
  for (const action of history) {
    const player = state.actingPlayer;

    if (action === PREFLOP_ACTIONS.FOLD) {
      // Fold doesn't change monetary values, just ends action
      state.hasActed[player] = true;
    } else if (action === PREFLOP_ACTIONS.CHECK) {
      state.hasActed[player] = true;
    } else if (action === PREFLOP_ACTIONS.CALL) {
      const callAmount = state.currentBetBb - state.committedBb[player];
      state.stacksBb[player] -= callAmount;
      state.potBb += callAmount;
      state.committedBb[player] = state.currentBetBb;
      state.hasActed[player] = true;
    } else if (action === PREFLOP_ACTIONS.ALL_IN) {
      const allinAmount = state.stacksBb[player];
      state.potBb += allinAmount;
      state.committedBb[player] += allinAmount;
      state.currentBetBb = Math.max(state.currentBetBb, state.committedBb[player]);
      state.stacksBb[player] = 0;
      state.hasActed[player] = true;
      state.raiseCount++;
    } else if (action.startsWith('RAISE_')) {
      // Parse raise amount from action ID (e.g., "RAISE_2.2" -> 2.2)
      const multiple = parseFloat(action.substring(6));
      const raiseAmount = roundToBb(state.currentBetBb * multiple);
      const totalCommit = Math.min(raiseAmount, state.stacksBb[player] + state.committedBb[player]);
      const increment = totalCommit - state.committedBb[player];

      state.stacksBb[player] -= increment;
      state.potBb += increment;
      state.committedBb[player] = totalCommit;
      state.currentBetBb = totalCommit;
      state.hasActed[player] = true;
      state.raiseCount++;
    }

    // Alternate acting player
    state.actingPlayer = (1 - player) as Player;
  }

  return state;
}

// ========================================
// Terminal Detection
// ========================================

/**
 * Determines if a game state is terminal (no more actions possible).
 *
 * Terminal conditions for preflop:
 * 1. A player folded
 * 2. Both players are all-in
 * 3. Both have acted and action is closed (last action was a call)
 *
 * @param history - Action sequence from game start
 * @param config - Tree configuration
 * @returns true if the game state is terminal
 */
export function isTerminal(history: readonly string[], config: TreeConfig): boolean {
  if (history.length === 0) {
    return false;
  }

  const lastAction = history[history.length - 1];

  // Fold is always terminal
  if (lastAction === PREFLOP_ACTIONS.FOLD) {
    return true;
  }

  const state = computeGameState(history, config);

  // Both players all-in
  if (state.stacksBb[0] === 0 && state.stacksBb[1] === 0) {
    return true;
  }

  // Action is closed: both have acted and last action was CALL (or CHECK if no bet)
  if (state.hasActed[0] && state.hasActed[1]) {
    // If last action was CALL and we're back to the original raiser, action is closed
    if (lastAction === PREFLOP_ACTIONS.CALL) {
      return true;
    }
    // If last action was CHECK (no bet to call), both have checked
    if (lastAction === PREFLOP_ACTIONS.CHECK) {
      return true;
    }
  }

  return false;
}

// ========================================
// Available Actions
// ========================================

/**
 * Gets available actions at a decision point.
 *
 * Actions are deterministically sorted for consistent info set enumeration.
 * The order is: FOLD, CHECK/CALL, RAISE sizes (ascending), ALL_IN
 *
 * @param history - Action sequence from game start
 * @param config - Tree configuration
 * @returns Array of available action IDs, sorted deterministically
 */
export function getAvailableActions(history: readonly string[], config: TreeConfig): string[] {
  const state = computeGameState(history, config);
  const actions: string[] = [];
  const player = state.actingPlayer;

  // If player is already all-in, no actions available
  if (state.stacksBb[player] === 0) {
    return [];
  }

  // Calculate amounts
  const toCall = state.currentBetBb - state.committedBb[player];
  const effectiveStack = state.stacksBb[player];

  // FOLD is always available unless there's nothing to call
  if (toCall > 0) {
    actions.push(PREFLOP_ACTIONS.FOLD);
  }

  // CHECK if no bet to call, CALL otherwise
  if (toCall === 0) {
    actions.push(PREFLOP_ACTIONS.CHECK);
  } else if (effectiveStack >= toCall) {
    actions.push(PREFLOP_ACTIONS.CALL);
  }

  // Raise options (if we have enough stack and haven't hit raise cap)
  const maxRaisesPerStreet = 4; // Standard cap
  if (state.raiseCount < maxRaisesPerStreet && effectiveStack > toCall) {
    // Get abstracted raise sizes
    const raiseSizes = getAbstractedRaiseSizes(
      {
        street: 'PREFLOP',
        position: 'IP', // Position doesn't affect size calculation
        potBb: state.potBb,
        stackBb: effectiveStack,
        facingBetBb: state.currentBetBb,
      },
      config.actionAbstraction.raiseSizes.PREFLOP,
      config.actionAbstraction.allInThreshold
    );

    // Calculate total commitment for all-in
    const totalStackForAllIn = effectiveStack + state.committedBb[player];

    // Convert BB amounts to action IDs
    for (const sizeBb of raiseSizes) {
      // Calculate the multiple of current bet
      const multiple = sizeBb / state.currentBetBb;

      // Check if this raise is effectively all-in (within rounding tolerance)
      const isEffectivelyAllIn = Math.abs(sizeBb - totalStackForAllIn) < 0.25;

      // Map to standard action IDs
      if (isEffectivelyAllIn) {
        // This is effectively all-in
        if (!actions.includes(PREFLOP_ACTIONS.ALL_IN)) {
          actions.push(PREFLOP_ACTIONS.ALL_IN);
        }
      } else if (multiple >= 2.9 && multiple <= 3.1) {
        if (!actions.includes(PREFLOP_ACTIONS.RAISE_3)) {
          actions.push(PREFLOP_ACTIONS.RAISE_3);
        }
      } else if (multiple >= 2.4 && multiple <= 2.6) {
        if (!actions.includes(PREFLOP_ACTIONS.RAISE_2_5)) {
          actions.push(PREFLOP_ACTIONS.RAISE_2_5);
        }
      } else if (multiple >= 2.1 && multiple <= 2.3) {
        if (!actions.includes(PREFLOP_ACTIONS.RAISE_2_2)) {
          actions.push(PREFLOP_ACTIONS.RAISE_2_2);
        }
      }
    }

    // Add all-in if stack is shallow relative to pot OR facing bet
    const stackPotRatio = effectiveStack / state.potBb;
    const stackBetRatio = toCall > 0 ? effectiveStack / toCall : Infinity;
    // Include all-in when stack is shallow relative to pot or when facing significant bet
    if (stackPotRatio <= config.actionAbstraction.allInThreshold ||
        (toCall > 0 && stackBetRatio <= config.actionAbstraction.allInThreshold * 1.5)) {
      if (!actions.includes(PREFLOP_ACTIONS.ALL_IN)) {
        actions.push(PREFLOP_ACTIONS.ALL_IN);
      }
    }
  }

  // Sort for determinism: FOLD, CHECK, CALL, RAISE_2.2, RAISE_2.5, RAISE_3, ALL_IN
  const actionOrder: string[] = [
    PREFLOP_ACTIONS.FOLD,
    PREFLOP_ACTIONS.CHECK,
    PREFLOP_ACTIONS.CALL,
    PREFLOP_ACTIONS.RAISE_2_2,
    PREFLOP_ACTIONS.RAISE_2_5,
    PREFLOP_ACTIONS.RAISE_3,
    PREFLOP_ACTIONS.ALL_IN,
  ];
  actions.sort((a, b) => actionOrder.indexOf(a) - actionOrder.indexOf(b));

  return actions;
}

// ========================================
// Terminal Utility
// ========================================

/**
 * Computes utility values at a terminal node.
 *
 * For preflop, utilities are based on:
 * - Fold: folder loses their equity in pot
 * - All-in showdown: equity calculation based on hand strength
 *
 * Returns utilities in BB (big blinds), which is the standard unit.
 * Zero-sum: utilities[0] = -utilities[1]
 *
 * @param history - Action sequence that led to terminal
 * @param hands - [hand0, hand1] canonical hands for both players
 * @param config - Tree configuration
 * @returns Utility values [player0, player1] in BB
 */
export function computeTerminalUtility(
  history: readonly string[],
  hands: readonly [CanonicalHand, CanonicalHand],
  config: TreeConfig
): [number, number] {
  const state = computeGameState(history, config);
  const lastAction = history[history.length - 1];

  // Fold: non-folder wins the pot
  if (lastAction === PREFLOP_ACTIONS.FOLD) {
    // Figure out who folded - it's the player who took the last action
    // State's actingPlayer is the NEXT player, so folder is opposite
    const folder: Player = (1 - state.actingPlayer) as Player;
    const winner: Player = state.actingPlayer;

    // Winner gains what folder put in, folder loses what they put in
    // Utility = (what I win) - (what I've put in) = net profit in BB
    // For folder: -committedBb[folder]
    // For winner: potBb - committedBb[winner]
    const folderUtility = -state.committedBb[folder];
    const winnerUtility = state.potBb - state.committedBb[winner];

    return folder === 0
      ? [folderUtility, winnerUtility]
      : [winnerUtility, folderUtility];
  }

  // Showdown: compare hand strength
  // For preflop all-in, we'd need equity calculation
  // For now, use a simplified model: higher canonical hand wins
  // This is a placeholder - real implementation would use hand evaluator
  const hand0Strength = getHandStrength(hands[0]);
  const hand1Strength = getHandStrength(hands[1]);

  const totalPot = state.potBb;

  if (hand0Strength > hand1Strength) {
    // Player 0 wins
    return [
      totalPot - state.committedBb[0],
      -state.committedBb[1],
    ];
  } else if (hand1Strength > hand0Strength) {
    // Player 1 wins
    return [
      -state.committedBb[0],
      totalPot - state.committedBb[1],
    ];
  } else {
    // Chop - each player gets back what they put in (net 0)
    return [0, 0];
  }
}

/**
 * Simple hand strength heuristic for preflop.
 * Higher = stronger hand.
 *
 * This is a placeholder for proper equity calculation.
 * Real implementation would use precomputed equity tables.
 */
function getHandStrength(hand: CanonicalHand): number {
  const ranks = 'AKQJT98765432';

  if (hand.length === 2) {
    // Pair: AA=12, KK=11, ... 22=0
    const rank = hand[0];
    return 200 + (12 - ranks.indexOf(rank)) * 10;
  }

  const highRank = hand[0];
  const lowRank = hand[1];
  const isSuited = hand[2] === 's';

  // Base strength from ranks
  const highValue = 12 - ranks.indexOf(highRank);
  const lowValue = 12 - ranks.indexOf(lowRank);

  let strength = highValue * 10 + lowValue;
  if (isSuited) {
    strength += 5; // Suited bonus
  }

  return strength;
}

// ========================================
// Player Alternation
// ========================================

/**
 * Returns the next player in a two-player game.
 *
 * @param currentPlayer - Current acting player
 * @returns The other player
 */
export function getNextPlayer(currentPlayer: Player): Player {
  return (1 - currentPlayer) as Player;
}

// ========================================
// Node Creation
// ========================================

/**
 * Creates a decision node with lazy child generation.
 *
 * Children are not created until getChild is called, which enables
 * memory-efficient traversal of massive game trees.
 *
 * @param history - Action sequence to reach this node
 * @param player - Player who acts at this node
 * @param hand - Player's canonical hand
 * @param config - Tree configuration
 * @returns DecisionNode with lazy getChild function
 */
export function createDecisionNode(
  history: readonly string[],
  player: Player,
  hand: CanonicalHand,
  config: TreeConfig
): DecisionNode {
  const nodeId = buildNodeId(history);
  const infoSetId = buildInfoSetId(player, hand, history);
  const actions = getAvailableActions(history, config);

  // Cache for lazy children
  const childCache = new Map<string, GameNode>();

  return {
    nodeId,
    nodeType: 'DECISION',
    depth: history.length,
    history,
    player,
    infoSetId,
    actions,
    getChild(action: string): GameNode {
      // Return cached child if exists
      const cached = childCache.get(action);
      if (cached !== undefined) {
        return cached;
      }

      // Validate action
      if (!actions.includes(action)) {
        throw new Error(`Invalid action '${action}' at node ${nodeId}. Valid actions: ${actions.join(', ')}`);
      }

      // Create new history
      const newHistory = [...history, action];

      // Create child node based on terminal check
      let child: GameNode;
      if (isTerminal(newHistory, config)) {
        // Create terminal node (need opponent's hand for utility, use placeholder)
        child = createTerminalNode(newHistory, config);
      } else {
        // Create next decision node
        const nextPlayer = getNextPlayer(player);
        child = createDecisionNode(newHistory, nextPlayer, hand, config);
      }

      childCache.set(action, child);
      return child;
    },
  };
}

/**
 * Creates a terminal node.
 *
 * @param history - Action sequence that led to this terminal
 * @param config - Tree configuration
 * @param hands - Optional hands for utility calculation
 * @returns TerminalNode
 */
export function createTerminalNode(
  history: readonly string[],
  config: TreeConfig,
  hands?: readonly [CanonicalHand, CanonicalHand]
): TerminalNode {
  const nodeId = buildNodeId(history);

  // Calculate utilities if hands provided
  let utilities: [number, number] = [0, 0];
  let winner: Player | undefined;

  if (hands) {
    utilities = computeTerminalUtility(history, hands, config);
    if (utilities[0] > 0) winner = 0;
    else if (utilities[1] > 0) winner = 1;
  } else {
    // Determine winner from last action
    const lastAction = history[history.length - 1];
    if (lastAction === PREFLOP_ACTIONS.FOLD) {
      const state = computeGameState(history, config);
      winner = state.actingPlayer; // Next player wins (folder was previous)
      // Utilities are calculated based on pot and commitments
      utilities = [
        winner === 0 ? state.potBb - state.committedBb[0] : -state.committedBb[0],
        winner === 1 ? state.potBb - state.committedBb[1] : -state.committedBb[1],
      ];
    }
  }

  return {
    nodeId,
    nodeType: 'TERMINAL',
    depth: history.length,
    history,
    utilities,
    winner,
  };
}

// ========================================
// Preflop Tree Creation
// ========================================

/**
 * Creates the root chance node for a preflop tree.
 *
 * The root is a chance node representing the deal of cards.
 * For preflop, there are 169 canonical starting hands.
 *
 * @param config - Tree configuration
 * @returns ChanceNode representing the deal
 */
export function createPreflopTree(config: TreeConfig): ChanceNode {
  const nodeId = 'DEAL';

  // All 169 canonical hands as outcomes
  const outcomes = [...CANONICAL_HANDS];

  // Equal probability for each canonical hand (simplified)
  // Real probabilities would account for combination counts
  const probabilities = outcomes.map(() => 1 / outcomes.length);

  // Cache for lazy children
  const childCache = new Map<string, GameNode>();

  return {
    nodeId,
    nodeType: 'CHANCE',
    depth: 0,
    history: [],
    outcomes,
    probabilities,
    getChild(outcome: string): GameNode {
      // Return cached child if exists
      const cached = childCache.get(outcome);
      if (cached !== undefined) {
        return cached;
      }

      // Validate outcome
      if (!outcomes.includes(outcome)) {
        throw new Error(`Invalid outcome '${outcome}'. Not a valid canonical hand.`);
      }

      // Create first decision node (SB acts first preflop)
      const child = createDecisionNode([], 0, outcome, config);
      childCache.set(outcome, child);
      return child;
    },
  };
}

// ========================================
// Card Removal
// ========================================

/**
 * Gets valid villain hands considering card removal (blocker effects).
 *
 * When hero holds certain cards, villain cannot hold those same cards.
 * This function filters the 169 canonical hands to those that are
 * actually possible given hero's holding.
 *
 * @param heroHand - Hero's canonical hand
 * @returns Array of valid villain canonical hands
 */
export function getValidVillainHands(heroHand: CanonicalHand): CanonicalHand[] {
  // Get actual card combinations for hero's hand
  const heroCombos = getAllCombosForCanonical(heroHand);

  // For each canonical villain hand, check if any combo is blocked
  const validHands: CanonicalHand[] = [];

  for (const villainCanonical of CANONICAL_HANDS) {
    const villainCombos = getAllCombosForCanonical(villainCanonical);

    // Count how many combos are unblocked
    let unblockedCount = 0;
    for (const [v1, v2] of villainCombos) {
      // Check if villain's cards conflict with any hero combo
      let blocked = false;
      for (const [h1, h2] of heroCombos) {
        if (v1 === h1 || v1 === h2 || v2 === h1 || v2 === h2) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        unblockedCount++;
      }
    }

    // If at least one combo is unblocked, this hand is possible
    if (unblockedCount > 0) {
      validHands.push(villainCanonical);
    }
  }

  return validHands;
}

/**
 * Counts unblocked combinations for a villain hand given hero's hand.
 *
 * @param heroHand - Hero's canonical hand
 * @param villainHand - Villain's canonical hand
 * @returns Number of unblocked combinations
 */
export function countUnblockedCombos(heroHand: CanonicalHand, villainHand: CanonicalHand): number {
  const heroCombos = getAllCombosForCanonical(heroHand);
  const villainCombos = getAllCombosForCanonical(villainHand);

  let unblockedCount = 0;
  for (const [v1, v2] of villainCombos) {
    let blocked = false;
    for (const [h1, h2] of heroCombos) {
      if (v1 === h1 || v1 === h2 || v2 === h1 || v2 === h2) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      unblockedCount++;
    }
  }

  return unblockedCount;
}

// ========================================
// Preflop Scenario Creation
// ========================================

/**
 * Creates a preflop training scenario from hero's perspective.
 *
 * This is used for generating training hands where hero faces a specific
 * situation (e.g., opening, facing a 3-bet, etc.).
 *
 * @param heroHand - Hero's canonical hand
 * @param villainRange - Array of villain's possible hands
 * @param config - Preflop tree configuration
 * @returns DecisionNode at hero's decision point
 */
export function createPreflopScenario(
  heroHand: CanonicalHand,
  villainRange: CanonicalHand[],
  config: PreflopTreeConfig
): DecisionNode {
  // Determine hero's player index based on position
  // SB = player 0, BB = player 1
  const heroPlayer: Player = config.heroPosition === 'SB' ? 0 : 1;

  // Create decision node at the point after prior actions
  return createDecisionNode(
    config.priorActions,
    heroPlayer,
    heroHand,
    config
  );
}
