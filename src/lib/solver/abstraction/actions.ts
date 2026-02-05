// src/lib/solver/abstraction/actions.ts
// Bet and raise size abstraction utilities for the solver.

import type { Street } from '../../engine/types';
import type { ActionAbstraction } from '../../engine/nodeTypes';
import type { BetSizeConfig, AbstractedAction, ActionAbstractionConfig } from '../types';

/**
 * Default bet sizes as fractions of pot per street.
 * Preflop uses raise multiples, not pot fractions, so only 1.0 is included
 * as a placeholder (actual preflop opens use DEFAULT_RAISE_SIZES).
 */
export const DEFAULT_BET_SIZES: Record<Street, number[]> = {
  PREFLOP: [1.0], // Preflop uses raise multiples, not pot fractions
  FLOP: [0.33, 0.5, 0.75, 1.0],
  TURN: [0.33, 0.5, 0.75, 1.0],
  RIVER: [0.33, 0.5, 0.75, 1.0],
};

/**
 * Default raise sizes as multiples of facing bet per street.
 * Standard sizes are 2.2x-3x for opens and 3-bets.
 */
export const DEFAULT_RAISE_SIZES: Record<Street, number[]> = {
  PREFLOP: [2.2, 2.5, 3.0], // Standard 2.2-3x opens/3bets
  FLOP: [2.2, 2.5, 3.0],
  TURN: [2.2, 2.5, 3.0],
  RIVER: [2.2, 2.5, 3.0],
};

/**
 * Default threshold for automatically including all-in option.
 * When stack <= threshold * pot, all-in is added to available actions.
 */
export const DEFAULT_ALL_IN_THRESHOLD = 2.0;

/**
 * Default threshold for including all-in when facing a bet.
 * When stack <= threshold * facingBet, all-in is added to raise options.
 */
export const DEFAULT_RAISE_ALL_IN_THRESHOLD = 3.0;

/**
 * Rounds a BB amount to 0.5 BB precision.
 * This is standard for solvers to avoid floating point accumulation errors.
 *
 * @param amount - Amount in big blinds
 * @returns Amount rounded to nearest 0.5 BB
 */
export function roundToBb(amount: number): number {
  return Math.round(amount * 2) / 2;
}

/**
 * Computes abstracted bet sizes for a given game state.
 *
 * Bet sizes are expressed as fractions of the pot. This function converts
 * those fractions to actual BB amounts and handles edge cases like:
 * - Filtering bets larger than effective stack
 * - Adding all-in when stack is shallow
 * - Deduplicating sizes (e.g., if 75% pot equals all-in)
 *
 * @param config - Current game state configuration
 * @param sizes - Pot fractions to use (defaults to street-appropriate sizes)
 * @param allInThreshold - Stack/pot ratio below which to add all-in (default 2.0)
 * @returns Array of bet amounts in BB, sorted ascending, no duplicates
 */
export function getAbstractedBetSizes(
  config: BetSizeConfig,
  sizes?: number[],
  allInThreshold: number = DEFAULT_ALL_IN_THRESHOLD
): number[] {
  const { street, potBb, stackBb } = config;

  // Handle edge cases
  if (potBb <= 0 || stackBb <= 0) {
    return stackBb > 0 ? [roundToBb(stackBb)] : [];
  }

  const potFractions = sizes ?? DEFAULT_BET_SIZES[street];

  // Convert pot fractions to BB amounts
  const betAmounts: number[] = [];

  for (const fraction of potFractions) {
    const betBb = roundToBb(potBb * fraction);

    // Only include bets that fit within stack
    if (betBb > 0 && betBb <= stackBb) {
      betAmounts.push(betBb);
    }
  }

  // Add all-in if stack is shallow (stack <= threshold * pot)
  const shouldAddAllIn = stackBb <= allInThreshold * potBb;
  if (shouldAddAllIn) {
    const allInAmount = roundToBb(stackBb);
    if (allInAmount > 0) {
      betAmounts.push(allInAmount);
    }
  }

  // Deduplicate and sort
  const uniqueAmounts = [...new Set(betAmounts)].sort((a, b) => a - b);

  return uniqueAmounts;
}

/**
 * Computes abstracted raise sizes for a given game state.
 *
 * Raise sizes are expressed as multiples of the facing bet. For example,
 * facing a 3BB bet with a 2.5x raise size means raising to 7.5BB total.
 *
 * This function handles:
 * - Minimum raise requirement (2x facing bet per poker rules)
 * - Filtering raises larger than effective stack
 * - Adding all-in when stack is shallow relative to facing bet
 * - Deduplicating sizes
 *
 * @param config - Current game state configuration (facingBetBb required)
 * @param sizes - Raise multiples to use (defaults to street-appropriate sizes)
 * @param allInThreshold - Stack/facingBet ratio below which to add all-in (default 3.0)
 * @returns Array of raise amounts in BB (total bet, not raise increment), sorted ascending
 */
export function getAbstractedRaiseSizes(
  config: BetSizeConfig,
  sizes?: number[],
  allInThreshold: number = DEFAULT_RAISE_ALL_IN_THRESHOLD
): number[] {
  const { street, stackBb, facingBetBb } = config;

  // facingBetBb is required for raise calculations
  if (facingBetBb === undefined || facingBetBb <= 0) {
    return [];
  }

  // Handle edge cases
  if (stackBb <= 0) {
    return [];
  }

  // Minimum raise is 2x the facing bet (poker rules)
  const minRaise = roundToBb(facingBetBb * 2);

  // If we can't even min-raise, all-in is the only option
  if (minRaise > stackBb) {
    return stackBb > facingBetBb ? [roundToBb(stackBb)] : [];
  }

  const raiseMultiples = sizes ?? DEFAULT_RAISE_SIZES[street];

  // Convert raise multiples to BB amounts
  const raiseAmounts: number[] = [];

  for (const multiple of raiseMultiples) {
    const raiseBb = roundToBb(facingBetBb * multiple);

    // Only include raises that are at least min-raise and fit within stack
    if (raiseBb >= minRaise && raiseBb <= stackBb) {
      raiseAmounts.push(raiseBb);
    }
  }

  // Add all-in if stack is shallow relative to facing bet
  const shouldAddAllIn = stackBb <= allInThreshold * facingBetBb;
  if (shouldAddAllIn) {
    const allInAmount = roundToBb(stackBb);
    if (allInAmount >= minRaise) {
      raiseAmounts.push(allInAmount);
    }
  }

  // Deduplicate and sort
  const uniqueAmounts = [...new Set(raiseAmounts)].sort((a, b) => a - b);

  return uniqueAmounts;
}

/**
 * Creates an AbstractedAction for a bet.
 *
 * @param amountBb - Bet amount in big blinds
 * @param potBb - Current pot size for calculating pot fraction
 * @returns AbstractedAction of type 'BET'
 */
export function createBetAction(amountBb: number, potBb: number): AbstractedAction {
  return {
    type: 'BET',
    amountBb,
    potFraction: potBb > 0 ? amountBb / potBb : 0,
  };
}

/**
 * Creates an AbstractedAction for a raise.
 *
 * @param amountBb - Total raise amount in big blinds
 * @param facingBetBb - Bet being faced
 * @returns AbstractedAction of type 'RAISE'
 */
export function createRaiseAction(amountBb: number, facingBetBb: number): AbstractedAction {
  return {
    type: 'RAISE',
    amountBb,
    raiseMultiple: facingBetBb > 0 ? amountBb / facingBetBb : 0,
  };
}

/**
 * Creates an AbstractedAction for all-in.
 *
 * @param amountBb - All-in amount in big blinds
 * @returns AbstractedAction of type 'ALL_IN'
 */
export function createAllInAction(amountBb: number): AbstractedAction {
  return {
    type: 'ALL_IN',
    amountBb,
  };
}

/**
 * Converts solver ActionAbstractionConfig to engine ActionAbstraction format.
 *
 * The solver uses pot fractions and raise multiples, while the engine needs
 * absolute BB amounts. This function bridges the two representations.
 *
 * @param config - Solver action abstraction configuration
 * @param street - Current street for street-specific sizes
 * @param potBb - Current pot size in big blinds
 * @param stackBb - Effective stack size in big blinds
 * @param facingBetBb - Optional facing bet for raise calculations
 * @param maxRaisesPerStreet - Maximum raises allowed per street (default: 4)
 * @returns Engine-compatible ActionAbstraction
 */
export function toEngineActionAbstraction(
  config: ActionAbstractionConfig,
  street: Street,
  potBb: number,
  stackBb: number,
  facingBetBb?: number,
  maxRaisesPerStreet: number = 4
): ActionAbstraction {
  const betSizeConfig: BetSizeConfig = {
    street,
    position: 'IP', // Position doesn't affect size calculation in current implementation
    potBb,
    stackBb,
    facingBetBb,
  };

  // Use 0 to disable all-in (condition stack <= 0 * pot is never true for positive stacks)
  const allInThreshold = config.includeAllIn ? config.allInThreshold : 0;

  // Compute bet sizes in BB
  const betSizesBb = getAbstractedBetSizes(
    betSizeConfig,
    config.betSizes[street],
    allInThreshold
  );

  // Compute raise sizes in BB (only if facing a bet)
  let raiseSizesBb: number[] = [];
  if (facingBetBb !== undefined && facingBetBb > 0) {
    raiseSizesBb = getAbstractedRaiseSizes(
      betSizeConfig,
      config.raiseSizes[street],
      config.includeAllIn ? config.allInThreshold : 0
    );
  }

  return {
    betSizesBb,
    raiseSizesBb,
    maxRaisesPerStreet,
  };
}
