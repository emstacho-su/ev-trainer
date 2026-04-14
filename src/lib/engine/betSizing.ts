// src/lib/engine/betSizing.ts
// NLHE bet sizing calculator. Pure functions, all units in BB.

import type { GameState } from "./gameState";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NUM_EPS = 1e-9;

/** Standard GTO bet sizes as fractions of pot. */
const STANDARD_BET_FRACTIONS = [0.25, 0.33, 0.5, 0.75, 1.0, 1.5] as const;

/** Standard GTO raise multiples of the current bet. */
const STANDARD_RAISE_MULTIPLES = [2.0, 2.5, 3.0] as const;

// ---------------------------------------------------------------------------
// Core sizing functions
// ---------------------------------------------------------------------------

/** Minimum legal opening bet on any street (1 BB). */
export function calculateMinBet(gs: GameState): number {
  const playerStack = gs.stacks[gs.toAct];
  const minBet = gs.blinds.bb;
  return Math.min(minBet, playerStack);
}

/**
 * Minimum legal raise total.
 * Rule: raise must increase the total bet by at least the previous raise increment.
 * minRaise = currentHighBet + lastRaiseIncrement
 */
export function calculateMinRaise(gs: GameState): number {
  const currentHigh = Math.max(0, ...Object.values(gs.bets));
  const minRaiseTotal = currentHigh + gs.lastRaiseIncrement;
  const playerMax = gs.stacks[gs.toAct] + gs.bets[gs.toAct];

  // If player can't afford min raise, they can still go all-in
  return Math.min(minRaiseTotal, playerMax);
}

/** Maximum legal bet/raise — player's entire remaining stack. */
export function calculateMaxBet(gs: GameState): number {
  return gs.stacks[gs.toAct];
}

/** Maximum raise total — stack + current bet. */
export function calculateMaxRaise(gs: GameState): number {
  return gs.stacks[gs.toAct] + gs.bets[gs.toAct];
}

/**
 * Pot-sized bet amount.
 *
 * When not facing a bet: potBet = totalPot
 * When facing a bet:     potBet = totalPot + callAmount
 *
 * (The standard formula: you call, then bet the resulting pot.)
 */
export function calculatePotSizedBet(gs: GameState): number {
  const totalPot = gs.pot + sumBets(gs);
  const playerBet = gs.bets[gs.toAct];
  const currentHigh = Math.max(0, ...Object.values(gs.bets));
  const callAmount = Math.max(0, currentHigh - playerBet);

  // Pot after calling + the call itself = effective pot
  const potBet = totalPot + callAmount;
  const maxBet = gs.stacks[gs.toAct];

  return Math.min(potBet, maxBet);
}

// ---------------------------------------------------------------------------
// Standard sizing helpers
// ---------------------------------------------------------------------------

/**
 * Get standard GTO bet sizes in BB for the current game state.
 * Returns sizes filtered to [minBet, maxBet] range.
 */
export function getStandardBetSizes(gs: GameState): number[] {
  const totalPot = gs.pot + sumBets(gs);
  const minBet = calculateMinBet(gs);
  const maxBet = calculateMaxBet(gs);

  if (maxBet < minBet - NUM_EPS) return [];

  const sizes = STANDARD_BET_FRACTIONS
    .map((frac) => roundBb(totalPot * frac))
    .filter((size) => size >= minBet - NUM_EPS && size <= maxBet + NUM_EPS)
    .map((size) => clamp(size, minBet, maxBet));

  // Always include all-in if it's a meaningful amount
  const allIn = roundBb(maxBet);
  if (allIn > NUM_EPS && allIn >= minBet - NUM_EPS && !sizes.some((s) => Math.abs(s - allIn) < NUM_EPS)) {
    sizes.push(allIn);
  }

  return dedup(sizes);
}

/**
 * Get standard GTO raise sizes in BB for the current game state.
 * Returns raise totals filtered to [minRaise, maxRaise] range.
 */
export function getStandardRaiseSizes(gs: GameState): number[] {
  const currentHigh = Math.max(0, ...Object.values(gs.bets));
  const minRaise = calculateMinRaise(gs);
  const maxRaise = calculateMaxRaise(gs);

  if (maxRaise < minRaise - NUM_EPS) return [];

  const sizes = STANDARD_RAISE_MULTIPLES
    .map((mult) => roundBb(currentHigh * mult))
    .filter((size) => size >= minRaise - NUM_EPS && size <= maxRaise + NUM_EPS)
    .map((size) => clamp(size, minRaise, maxRaise));

  // Always include all-in if not already present
  const allIn = roundBb(maxRaise);
  if (allIn >= minRaise - NUM_EPS && !sizes.some((s) => Math.abs(s - allIn) < NUM_EPS)) {
    sizes.push(allIn);
  }

  return dedup(sizes);
}

// ---------------------------------------------------------------------------
// All-in helpers
// ---------------------------------------------------------------------------

/** Does this bet amount put the player all-in? */
export function isAllIn(betAmount: number, gs: GameState): boolean {
  return betAmount >= gs.stacks[gs.toAct] - NUM_EPS;
}

/**
 * Does an all-in constitute a "full raise" that reopens action?
 *
 * Rule: the all-in amount must increase the bet by at least the
 * previous raise increment to reopen betting.
 */
export function doesAllInReopenAction(
  allInTotal: number,
  previousHighBet: number,
  lastRaiseIncrement: number,
): boolean {
  const increment = allInTotal - previousHighBet;
  return increment >= lastRaiseIncrement - NUM_EPS;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sumBets(gs: GameState): number {
  return Object.values(gs.bets).reduce((sum, b) => sum + b, 0);
}

function roundBb(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function dedup(arr: number[]): number[] {
  const result: number[] = [];
  for (const v of arr) {
    if (!result.some((r) => Math.abs(r - v) < NUM_EPS)) {
      result.push(v);
    }
  }
  return result;
}
