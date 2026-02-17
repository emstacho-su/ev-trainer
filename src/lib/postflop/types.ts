// src/lib/postflop/types.ts
// Domain types for postflop training module.

import type { Card } from '../solver/types';
import type { SolverNodeOutput } from '../engine/solverAdapter';

/** Street in a postflop hand (flop, turn, river). */
export type Street = 'FLOP' | 'TURN' | 'RIVER';

/** Board texture classification. */
export type BoardTexture = 'MONOTONE' | 'PAIRED' | 'TWO_TONE' | 'CONNECTED' | 'RAINBOW';

/** State of a street decision in the training flow. */
export type StreetDecisionState = 'deciding' | 'evaluating' | 'advancing' | 'complete';

/** Top-level state of the postflop training machine. */
export type PostflopMachineState = 'deciding' | 'evaluating' | 'advancing' | 'summary' | 'idle';

/** A postflop spot defines the full context for a multi-street hand. */
export interface PostflopSpot {
  heroHand: [Card, Card];
  board: Card[];
  potBb: number;
  stackBb: number;
  heroPosition: 'IP' | 'OOP';
  villainPosition: 'IP' | 'OOP';
  preflopHistory: string;
}

/** A decision made on a single street. */
export interface StreetDecision {
  actionId: string;
  solverOutput: SolverNodeOutput | null;
  isOnSolverLine: boolean;
}

/** Summary data for a completed postflop hand. */
export interface HandSummaryData {
  spot: PostflopSpot;
  decisions: Partial<Record<Street, StreetDecision>>;
  deviatedStreet: Street | null;
  completedAt: string;
}
