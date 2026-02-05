// src/lib/solver/index.ts
// Public solver API surface.

// Type exports
export type {
  Rank,
  Suit,
  Card,
  Hand,
  CanonicalHand,
  SuitMapping,
  HandCategory,
  CanonicalizeResult,
  PositionRelative,
  BetSizeConfig,
  ActionAbstractionConfig,
  AbstractedAction,
} from './types';

export { RANKS, SUITS } from './types';

// Action abstraction exports
export {
  getAbstractedBetSizes,
  getAbstractedRaiseSizes,
  roundToBb,
  createBetAction,
  createRaiseAction,
  createAllInAction,
  toEngineActionAbstraction,
  DEFAULT_BET_SIZES,
  DEFAULT_RAISE_SIZES,
  DEFAULT_ALL_IN_THRESHOLD,
  DEFAULT_RAISE_ALL_IN_THRESHOLD,
} from './abstraction/actions';

// Card abstraction exports
export { canonicalizePreflop, buildPreflopAbstraction, CANONICAL_HANDS } from './abstraction/cards';
export { mapToCanonicalSuit, areIsomorphic, getSuitedStatus } from './abstraction/isomorphism';
