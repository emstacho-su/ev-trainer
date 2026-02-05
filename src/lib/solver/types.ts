// src/lib/solver/types.ts
// Core type definitions for the poker solver module.

import type { Position, Street } from '../engine/types';

// Re-export for convenience
export type { Position, Street } from '../engine/types';

/**
 * Position relative to button for sizing decisions.
 * IP = In Position (acts last postflop)
 * OOP = Out of Position (acts first postflop)
 */
export type PositionRelative = 'IP' | 'OOP';

/**
 * Configuration for computing bet sizes at a specific decision point.
 */
export interface BetSizeConfig {
  /** Current street */
  readonly street: Street;
  /** Player's relative position */
  readonly position: PositionRelative;
  /** Current pot size in big blinds */
  readonly potBb: number;
  /** Effective stack size in big blinds */
  readonly stackBb: number;
  /** Bet amount player is facing, for raise calculations */
  readonly facingBetBb?: number;
}

/**
 * Configuration for action abstraction across the game tree.
 */
export interface ActionAbstractionConfig {
  /** Bet sizes as fractions of pot per street (e.g., 0.33, 0.50, 0.75, 1.0) */
  readonly betSizes: Record<Street, number[]>;
  /** Raise sizes as multiples of facing bet per street (e.g., 2.2, 2.5, 3.0) */
  readonly raiseSizes: Record<Street, number[]>;
  /** Whether to automatically include all-in when stack is shallow */
  readonly includeAllIn: boolean;
  /** Stack/pot ratio below which to add all-in as an option */
  readonly allInThreshold: number;
}

/**
 * Abstracted action representation for solver.
 * Each action has a type and associated amount information.
 */
export type AbstractedAction =
  | { readonly type: 'FOLD' }
  | { readonly type: 'CHECK' }
  | { readonly type: 'CALL'; readonly amountBb: number }
  | { readonly type: 'BET'; readonly amountBb: number; readonly potFraction: number }
  | { readonly type: 'RAISE'; readonly amountBb: number; readonly raiseMultiple: number }
  | { readonly type: 'ALL_IN'; readonly amountBb: number };

/**
 * Card ranks from highest to lowest.
 * A=Ace, K=King, Q=Queen, J=Jack, T=Ten, then 9-2.
 */
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type Rank = (typeof RANKS)[number];

/**
 * Card suits.
 * h=hearts, d=diamonds, c=clubs, s=spades
 */
export const SUITS = ['h', 'd', 'c', 's'] as const;
export type Suit = (typeof SUITS)[number];

/**
 * A card is represented as a two-character string: rank + suit.
 * Examples: "Ah" (Ace of hearts), "Kc" (King of clubs), "2s" (Two of spades)
 */
export type Card = `${Rank}${Suit}`;

/**
 * A hand is a tuple of exactly two cards.
 * Order matters for internal processing but canonical forms normalize order.
 */
export type Hand = [Card, Card];

/**
 * Canonical hand representation for preflop abstraction.
 * Format:
 * - Pairs: "AA", "KK", ..., "22"
 * - Suited: "AKs", "AQs", ..., "32s"
 * - Offsuit: "AKo", "AQo", ..., "32o"
 */
export type CanonicalHand = string;

/**
 * Mapping of original suits to canonical suits.
 * Used for tracking how suits were remapped during canonicalization.
 */
export interface SuitMapping {
  readonly original: readonly [Suit, Suit];
  readonly canonical: readonly [Suit, Suit];
}

/**
 * Hand category for classification.
 */
export type HandCategory = 'pair' | 'suited' | 'offsuit';

/**
 * Result of canonicalizing a hand, including the mapping used.
 */
export interface CanonicalizeResult {
  readonly canonical: CanonicalHand;
  readonly category: HandCategory;
  readonly suitMapping: SuitMapping;
}

// ========================================
// CFR (Counterfactual Regret Minimization) Types
// ========================================

/**
 * Player index for two-player zero-sum games.
 * 0 = first player (typically SB/BTN)
 * 1 = second player (typically BB)
 */
export type Player = 0 | 1;

/**
 * Information set stores cumulative regrets and strategy sums for a decision point.
 * This is the core data structure for CFR - it tracks learning progress at each
 * information state where a player must make a decision.
 */
export interface InfoSet {
  /** Unique identifier for this information set */
  readonly infoSetId: string;
  /** Number of available actions at this decision point */
  readonly numActions: number;
  /** Cumulative regrets per action (CFR+ floors these at 0 after accumulation) */
  regretSum: Float64Array;
  /** Accumulated strategy sums for computing average strategy */
  strategySum: Float64Array;
  /** Action identifiers corresponding to array indices */
  readonly actions: readonly string[];
}

/**
 * Reach probabilities for counterfactual value calculation.
 * These track the probability of reaching a game state given each player's strategy.
 */
export interface ReachProbabilities {
  /** Reach probability contributed by the current player's actions */
  readonly current: number;
  /** Reach probability contributed by opponent's actions */
  readonly opponent: number;
  /** Reach probability contributed by chance nodes (card deals) */
  readonly chance: number;
}

/**
 * Configuration for CFR training runs.
 */
export interface CFRConfig {
  /** Maximum number of CFR iterations to run */
  readonly maxIterations: number;
  /** Target exploitability in mbb/game (stop when reached) */
  readonly targetExploitability: number;
  /** Callback for progress updates */
  readonly progressCallback?: (iteration: number, exploitability: number) => void;
  /** Check exploitability every N iterations (expensive operation) */
  readonly checkConvergenceEvery: number;
}

/**
 * Result of a CFR training run.
 */
export interface CFRResult {
  /** Whether the target exploitability was reached */
  readonly converged: boolean;
  /** Number of iterations completed */
  readonly iterations: number;
  /** Final exploitability in mbb/game */
  readonly exploitability: number;
  /** Total training time in milliseconds */
  readonly elapsedMs: number;
}

// ========================================
// Game Tree Types
// ========================================

/**
 * Node type discriminator for game tree traversal.
 * - DECISION: A player must choose an action
 * - CHANCE: Random event (e.g., card deal)
 * - TERMINAL: Game state with utility values
 */
export type NodeType = 'DECISION' | 'CHANCE' | 'TERMINAL';

/**
 * Base interface for all game tree nodes.
 * Contains common fields shared by decision, chance, and terminal nodes.
 */
export interface GameNodeBase {
  /** Unique identifier for this node (hash of history) */
  readonly nodeId: string;
  /** Discriminator for node type */
  readonly nodeType: NodeType;
  /** Depth in the game tree (root = 0) */
  readonly depth: number;
  /** Action sequence to reach this node from root */
  readonly history: readonly string[];
}

/**
 * Decision node where a player must choose an action.
 * Contains lazy child generation to avoid memory explosion.
 */
export interface DecisionNode extends GameNodeBase {
  readonly nodeType: 'DECISION';
  /** Which player acts at this node (0 or 1) */
  readonly player: Player;
  /** Canonical information set identifier for CFR lookup */
  readonly infoSetId: string;
  /** Available action IDs (deterministically sorted) */
  readonly actions: readonly string[];
  /** Lazy child generation - creates child node on first access */
  getChild(action: string): GameNode;
}

/**
 * Chance node representing a random event (card deals).
 * Outcomes have associated probabilities for EV calculation.
 */
export interface ChanceNode extends GameNodeBase {
  readonly nodeType: 'CHANCE';
  /** Possible outcomes (e.g., canonical hand combinations) */
  readonly outcomes: readonly string[];
  /** Probability of each outcome (must sum to 1) */
  readonly probabilities: readonly number[];
  /** Lazy child generation - creates child node on first access */
  getChild(outcome: string): GameNode;
}

/**
 * Terminal node with final utility values.
 * Utilities are expressed in BB and are zero-sum (u0 = -u1).
 */
export interface TerminalNode extends GameNodeBase {
  readonly nodeType: 'TERMINAL';
  /** Utility values for [player 0, player 1] in BB */
  readonly utilities: readonly [number, number];
  /** Winner of the pot (undefined for chop) */
  readonly winner?: Player;
}

/**
 * Union type for all game tree nodes.
 * Use nodeType discriminator for type narrowing.
 */
export type GameNode = DecisionNode | ChanceNode | TerminalNode;

/**
 * Configuration for building game trees.
 * Defines stack sizes, blinds, positions, and action abstraction.
 */
export interface TreeConfig {
  /** Starting effective stack size in big blinds */
  readonly startingStackBb: number;
  /** Small blind size in big blinds (typically 0.5) */
  readonly smallBlindBb: number;
  /** Big blind size in big blinds (always 1) */
  readonly bigBlindBb: number;
  /** Positions involved (e.g., ['SB', 'BB'] for heads-up) */
  readonly positions: readonly Position[];
  /** Action abstraction configuration for bet/raise sizes */
  readonly actionAbstraction: ActionAbstractionConfig;
}

/**
 * Extended configuration for preflop-specific tree generation.
 * Adds hero/villain positions and prior action context.
 */
export interface PreflopTreeConfig extends TreeConfig {
  /** Hero's position in the hand */
  readonly heroPosition: Position;
  /** Villain's position in the hand */
  readonly villainPosition: Position;
  /** Actions that occurred before the current decision point */
  readonly priorActions: readonly string[];
}
