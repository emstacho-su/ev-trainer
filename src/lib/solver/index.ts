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
} from './types';

export { RANKS, SUITS } from './types';

// Abstraction exports (to be populated)
// export { canonicalizePreflop, buildPreflopAbstraction, CANONICAL_HANDS } from './abstraction/cards';
// export { mapToCanonicalSuit, areIsomorphic, getSuitedStatus } from './abstraction/isomorphism';
