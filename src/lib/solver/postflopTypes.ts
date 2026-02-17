// src/lib/solver/postflopTypes.ts
// Shared types and constants for postflop solver, extracted to avoid
// pulling Node.js dependencies (poker-evaluator-ts) into client bundles.

import type {
  CFRConfig,
  CFRResult,
  Card,
  CanonicalHand,
  ActionAbstractionConfig,
  PositionRelative,
} from './types';
import type { Street } from '../engine/types';
import type { PostflopBucket } from './abstraction/cards';
import type { InfoSetStore } from './infoSet';

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
