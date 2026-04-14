// src/lib/engine/gameState.ts
// NLHE game state model and action legality engine.

import type { ActionId, ActionType, Position, Street } from "./types";
import { Positions } from "./types";
import type { Spot } from "./spot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full snapshot of a poker hand in progress. Immutable — use applyAction. */
export interface GameState {
  readonly street: Street;
  /** All seats at the table (ordered by seat). */
  readonly positions: readonly Position[];
  /** Positions still in the hand (not folded). */
  readonly activePositions: readonly Position[];
  /** Remaining stack per position (BB). */
  readonly stacks: Readonly<Record<Position, number>>;
  /** Amount committed on the CURRENT street per position (BB). */
  readonly bets: Readonly<Record<Position, number>>;
  /** Dead money from prior streets (BB). */
  readonly pot: number;
  /** Whose turn it is. */
  readonly toAct: Position;
  /** Last player who bet or raised this street. */
  readonly lastAggressor: Position | null;
  /** Size of the last raise increment this street (BB). */
  readonly lastRaiseIncrement: number;
  /** Positions that have acted voluntarily this street. */
  readonly actedThisStreet: readonly Position[];
  /** Full hand action history. */
  readonly history: readonly ActionId[];
  /** Whether a position is all-in. */
  readonly allIn: Readonly<Record<Position, boolean>>;
  /** Community cards. */
  readonly board: readonly string[];
  /** Blind structure. */
  readonly blinds: Readonly<{ sb: number; bb: number; ante?: number }>;
  /** Whether the current street's action is complete. */
  readonly streetComplete: boolean;
}

/** What the player to act can legally do. */
export interface LegalActions {
  readonly canCheck: boolean;
  readonly canBet: boolean;
  readonly canFold: boolean;
  readonly canCall: boolean;
  readonly canRaise: boolean;
  /** Amount needed to call (0 if can't call). */
  readonly callAmount: number;
  /** Minimum legal bet (0 if can't bet). */
  readonly minBet: number;
  /** Maximum legal bet — all-in (0 if can't bet). */
  readonly maxBet: number;
  /** Minimum legal raise total (0 if can't raise). */
  readonly minRaise: number;
  /** Maximum legal raise total — all-in (0 if can't raise). */
  readonly maxRaise: number;
}

/** Result of validating an action against a game state. */
export interface ActionValidation {
  readonly legal: boolean;
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NUM_EPS = 1e-9;

/** Preflop action order: UTG → HJ → CO → BTN → SB → BB */
const PREFLOP_ORDER: readonly Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

/** Postflop action order: SB → BB → UTG → HJ → CO → BTN */
const POSTFLOP_ORDER: readonly Position[] = ["SB", "BB", "UTG", "HJ", "CO", "BTN"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse an ActionId into type and optional size. Handles ALL_IN correctly. */
export function parseActionId(actionId: ActionId): { type: ActionType; sizeBb?: number } {
  if (actionId === "FOLD") return { type: "FOLD" };
  if (actionId === "CHECK") return { type: "CHECK" };
  if (actionId === "CALL") return { type: "CALL" };
  if (actionId === "ALL_IN") return { type: "ALL_IN" };

  if (actionId.startsWith("ALL_IN_")) {
    const sizeStr = actionId.slice(7); // after "ALL_IN_"
    const sizeBb = parseSizeSuffix(sizeStr);
    return { type: "ALL_IN", sizeBb };
  }
  if (actionId.startsWith("BET_")) {
    const sizeStr = actionId.slice(4);
    const sizeBb = parseSizeSuffix(sizeStr);
    return { type: "BET", sizeBb };
  }
  if (actionId.startsWith("RAISE_")) {
    const sizeStr = actionId.slice(6);
    const sizeBb = parseSizeSuffix(sizeStr);
    return { type: "RAISE", sizeBb };
  }

  throw new Error(`unrecognized actionId: ${actionId}`);
}

function parseSizeSuffix(s: string): number {
  const cleaned = s.endsWith("BB") ? s.slice(0, -2) : s;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid action size: ${s}`);
  }
  return n;
}

/** Get the action order for the given positions and street. */
function getActionOrder(positions: readonly Position[], street: Street): Position[] {
  const template = street === "PREFLOP" ? PREFLOP_ORDER : POSTFLOP_ORDER;
  return template.filter((p) => positions.includes(p));
}

/** Get the next position to act after `current`, skipping folded and all-in. */
function nextToAct(
  actionOrder: readonly Position[],
  current: Position,
  activePositions: readonly Position[],
  allIn: Readonly<Record<Position, boolean>>,
): Position | null {
  const idx = actionOrder.indexOf(current);
  if (idx === -1) return null;

  for (let i = 1; i <= actionOrder.length; i++) {
    const candidate = actionOrder[(idx + i) % actionOrder.length];
    if (activePositions.includes(candidate) && !allIn[candidate]) {
      return candidate;
    }
  }
  return null;
}

/** Sum of all current-street bets. */
function totalStreetBets(bets: Readonly<Record<Position, number>>): number {
  return Object.values(bets).reduce((sum, b) => sum + b, 0);
}

/** Highest bet on the current street. */
function highBet(bets: Readonly<Record<Position, number>>): number {
  return Math.max(0, ...Object.values(bets));
}

/** Count of active non-all-in players. */
function activeNonAllInCount(
  activePositions: readonly Position[],
  allIn: Readonly<Record<Position, boolean>>,
): number {
  return activePositions.filter((p) => !allIn[p]).length;
}

// ---------------------------------------------------------------------------
// createInitialGameState
// ---------------------------------------------------------------------------

/** Create an initial GameState from a Spot. */
export function createInitialGameState(spot: Spot): GameState {
  const { positions, stacksBb, potBb, board, history, heroToAct, blinds } = spot;

  const street: Street =
    board.length === 0 ? "PREFLOP"
      : board.length === 3 ? "FLOP"
        : board.length === 4 ? "TURN"
          : "RIVER";

  const stacks: Record<string, number> = {};
  const bets: Record<string, number> = {};
  const allIn: Record<string, boolean> = {};

  for (const pos of positions) {
    stacks[pos] = stacksBb[pos];
    bets[pos] = 0;
    allIn[pos] = false;
  }

  let pot = 0;

  if (street === "PREFLOP") {
    // Post blinds
    const sbPos = positions.includes("SB" as Position) ? "SB" : null;
    const bbPos = positions.includes("BB" as Position) ? "BB" : null;

    if (sbPos) {
      const sbAmount = Math.min(blinds.sb, stacks[sbPos]);
      bets[sbPos] = sbAmount;
      stacks[sbPos] -= sbAmount;
      if (stacks[sbPos] <= NUM_EPS) allIn[sbPos] = true;
    }

    if (bbPos) {
      const bbAmount = Math.min(blinds.bb, stacks[bbPos]);
      bets[bbPos] = bbAmount;
      stacks[bbPos] -= bbAmount;
      if (stacks[bbPos] <= NUM_EPS) allIn[bbPos] = true;
    }

    // Post antes
    if (blinds.ante && blinds.ante > 0) {
      for (const pos of positions) {
        const anteAmount = Math.min(blinds.ante, stacks[pos]);
        pot += anteAmount;
        stacks[pos] -= anteAmount;
        if (stacks[pos] <= NUM_EPS) allIn[pos] = true;
      }
    }
  } else {
    // Postflop: pot comes from prior streets, bets reset to 0
    pot = potBb;
  }

  const actionOrder = getActionOrder(positions, street);
  const activePositions = [...positions];
  const toAct = history.length > 0 ? heroToAct : actionOrder.find(
    (p) => activePositions.includes(p) && !allIn[p as Position],
  ) as Position ?? positions[0];

  return {
    street,
    positions: [...positions],
    activePositions,
    stacks: stacks as Record<Position, number>,
    bets: bets as Record<Position, number>,
    pot,
    toAct,
    lastAggressor: street === "PREFLOP" ? ("BB" as Position) : null,
    lastRaiseIncrement: street === "PREFLOP" ? blinds.bb : blinds.bb,
    actedThisStreet: [],
    history: [...history],
    allIn: allIn as Record<Position, boolean>,
    board: [...board],
    blinds: { ...blinds },
    streetComplete: false,
  };
}

// ---------------------------------------------------------------------------
// computeLegalActions
// ---------------------------------------------------------------------------

/** Determine what actions are legal for the player to act. */
export function computeLegalActions(gs: GameState): LegalActions {
  const empty: LegalActions = {
    canCheck: false, canBet: false, canFold: false,
    canCall: false, canRaise: false,
    callAmount: 0, minBet: 0, maxBet: 0, minRaise: 0, maxRaise: 0,
  };

  // No actions if street is complete or player is all-in
  if (gs.streetComplete) return empty;
  if (gs.allIn[gs.toAct]) return empty;
  if (activeNonAllInCount(gs.activePositions, gs.allIn) === 0) return empty;

  // Only one active player → hand is over
  if (gs.activePositions.length <= 1) return empty;

  const playerBet = gs.bets[gs.toAct];
  const currentHigh = highBet(gs.bets);
  const facingBet = currentHigh - playerBet;
  const playerStack = gs.stacks[gs.toAct];

  // Player has no chips → no actions
  if (playerStack <= NUM_EPS) return empty;

  const isFacingBet = facingBet > NUM_EPS;

  // BB option: preflop, toAct is BB, no raise occurred (only limps/calls)
  const isBBOption =
    gs.street === "PREFLOP" &&
    gs.toAct === "BB" &&
    facingBet <= NUM_EPS &&
    !gs.actedThisStreet.includes("BB" as Position);

  if (!isFacingBet && !isBBOption) {
    // No bet facing — can CHECK or BET
    const minBet = gs.blinds.bb;
    const maxBet = playerStack;
    return {
      canCheck: true,
      canBet: maxBet >= minBet - NUM_EPS,
      canFold: false,
      canCall: false,
      canRaise: false,
      callAmount: 0,
      minBet: Math.min(minBet, maxBet),
      maxBet,
      minRaise: 0,
      maxRaise: 0,
    };
  }

  if (isBBOption) {
    // BB can check (satisfied with blind) or raise
    const minRaise = currentHigh + gs.lastRaiseIncrement;
    const maxRaise = playerStack + playerBet;
    return {
      canCheck: true,
      canBet: false,
      canFold: false,
      canCall: false,
      canRaise: maxRaise >= minRaise - NUM_EPS,
      callAmount: 0,
      minBet: 0,
      maxBet: 0,
      minRaise: Math.min(minRaise, maxRaise),
      maxRaise,
    };
  }

  // Facing a bet — can FOLD, CALL, or RAISE
  const callAmount = Math.min(facingBet, playerStack);
  const canCall = true;
  const canFold = true;

  // Can raise if stack > call amount AND meets min raise
  const remainingAfterCall = playerStack - callAmount;
  const minRaiseTotal = currentHigh + gs.lastRaiseIncrement;
  const maxRaiseTotal = playerStack + playerBet;

  // Can raise if we have chips beyond the call amount
  const canRaise = remainingAfterCall > NUM_EPS && maxRaiseTotal >= minRaiseTotal - NUM_EPS;

  return {
    canCheck: false,
    canBet: false,
    canFold,
    canCall,
    canRaise,
    callAmount,
    minBet: 0,
    maxBet: 0,
    minRaise: canRaise ? Math.min(minRaiseTotal, maxRaiseTotal) : 0,
    maxRaise: canRaise ? maxRaiseTotal : 0,
  };
}

// ---------------------------------------------------------------------------
// validateActionLegality
// ---------------------------------------------------------------------------

/** Check if a specific action is legal in the given game state. */
export function validateActionLegality(
  actionId: ActionId,
  gs: GameState,
): ActionValidation {
  const legal = computeLegalActions(gs);
  const parsed = parseActionId(actionId);

  switch (parsed.type) {
    case "CHECK":
      return legal.canCheck
        ? { legal: true }
        : { legal: false, reason: "cannot check when facing a bet" };

    case "FOLD":
      return legal.canFold
        ? { legal: true }
        : { legal: false, reason: "cannot fold when not facing a bet — check instead" };

    case "CALL":
      return legal.canCall
        ? { legal: true }
        : { legal: false, reason: "nothing to call" };

    case "BET": {
      if (!legal.canBet) {
        return { legal: false, reason: "cannot bet — facing a bet, use raise instead" };
      }
      const size = parsed.sizeBb ?? 0;
      if (size < legal.minBet - NUM_EPS) {
        return { legal: false, reason: `bet ${size}BB below minimum ${legal.minBet}BB` };
      }
      if (size > legal.maxBet + NUM_EPS) {
        return { legal: false, reason: `bet ${size}BB exceeds stack ${legal.maxBet}BB` };
      }
      return { legal: true };
    }

    case "RAISE": {
      if (!legal.canRaise) {
        return { legal: false, reason: "cannot raise" };
      }
      const size = parsed.sizeBb ?? 0;
      if (size < legal.minRaise - NUM_EPS) {
        return { legal: false, reason: `raise to ${size}BB below minimum ${legal.minRaise}BB` };
      }
      if (size > legal.maxRaise + NUM_EPS) {
        return { legal: false, reason: `raise to ${size}BB exceeds stack` };
      }
      return { legal: true };
    }

    case "ALL_IN": {
      // All-in is always legal if player has chips and there's action to take
      if (legal.canBet || legal.canCall || legal.canRaise) {
        return { legal: true };
      }
      return { legal: false, reason: "no action available" };
    }

    default:
      return { legal: false, reason: `unknown action type: ${parsed.type}` };
  }
}

// ---------------------------------------------------------------------------
// applyAction
// ---------------------------------------------------------------------------

/** Apply an action to a game state and return a new immutable state. */
export function applyAction(gs: GameState, actionId: ActionId): GameState {
  const validation = validateActionLegality(actionId, gs);
  if (!validation.legal) {
    throw new Error(`illegal action ${actionId}: ${validation.reason}`);
  }

  const parsed = parseActionId(actionId);
  const pos = gs.toAct;

  // Deep copy mutable parts
  const stacks = { ...gs.stacks };
  const bets = { ...gs.bets };
  const allIn = { ...gs.allIn };
  let activePositions = [...gs.activePositions];
  let pot = gs.pot;
  let lastAggressor = gs.lastAggressor;
  let lastRaiseIncrement = gs.lastRaiseIncrement;
  const actedThisStreet = [...gs.actedThisStreet];
  const history = [...gs.history, actionId];

  const currentHigh = highBet(gs.bets);

  switch (parsed.type) {
    case "FOLD": {
      activePositions = activePositions.filter((p) => p !== pos);
      break;
    }

    case "CHECK": {
      // No chip movement
      break;
    }

    case "CALL": {
      const callAmount = Math.min(currentHigh - bets[pos], stacks[pos]);
      bets[pos] += callAmount;
      stacks[pos] -= callAmount;
      if (stacks[pos] <= NUM_EPS) {
        stacks[pos] = 0;
        allIn[pos] = true;
      }
      break;
    }

    case "BET": {
      const betSize = parsed.sizeBb!;
      const actual = Math.min(betSize, stacks[pos]);
      bets[pos] = actual;
      stacks[pos] -= actual;
      lastAggressor = pos;
      lastRaiseIncrement = actual; // first bet on street, increment = bet size
      if (stacks[pos] <= NUM_EPS) {
        stacks[pos] = 0;
        allIn[pos] = true;
      }
      break;
    }

    case "RAISE": {
      const raiseTotal = parsed.sizeBb!;
      const additional = Math.min(raiseTotal - bets[pos], stacks[pos]);
      const newBet = bets[pos] + additional;
      lastRaiseIncrement = newBet - currentHigh;
      bets[pos] = newBet;
      stacks[pos] -= additional;
      lastAggressor = pos;
      if (stacks[pos] <= NUM_EPS) {
        stacks[pos] = 0;
        allIn[pos] = true;
      }
      break;
    }

    case "ALL_IN": {
      const allInAmount = stacks[pos];
      const newBet = bets[pos] + allInAmount;
      if (newBet > currentHigh) {
        // This is an aggressive all-in (bet or raise)
        const raiseIncrement = newBet - currentHigh;
        if (raiseIncrement >= lastRaiseIncrement - NUM_EPS) {
          // Full raise — reopens action
          lastRaiseIncrement = raiseIncrement;
        }
        lastAggressor = pos;
      }
      bets[pos] = newBet;
      stacks[pos] = 0;
      allIn[pos] = true;
      break;
    }
  }

  // Track that this position has acted
  if (!actedThisStreet.includes(pos)) {
    actedThisStreet.push(pos);
  }

  // Determine next player to act
  const actionOrder = getActionOrder(gs.positions, gs.street);
  const newHigh = highBet(bets);
  let streetComplete = false;

  // Check if street action is complete
  const activePlayers = activePositions.filter((p) => !allIn[p]);

  if (activePositions.length <= 1) {
    // Everyone else folded
    streetComplete = true;
  } else if (activePlayers.length === 0) {
    // Everyone remaining is all-in
    streetComplete = true;
  } else {
    // Street is complete if all active non-all-in players have acted
    // and all bets are equalized
    const allActed = activePlayers.every((p) => actedThisStreet.includes(p));
    const allEqualized = activePlayers.every(
      (p) => Math.abs(bets[p] - newHigh) < NUM_EPS || allIn[p],
    );

    if (allActed && allEqualized) {
      // But a raise resets who needs to act — check if lastAggressor
      // was the most recent raiser and everyone after has responded
      streetComplete = true;
    }
  }

  // Find next to act (null if street complete)
  let toAct = gs.toAct;
  if (!streetComplete) {
    const next = nextToAct(actionOrder, pos, activePositions, allIn);
    if (next === null) {
      streetComplete = true;
    } else {
      toAct = next;

      // Re-check: if the next player is the last aggressor and all bets
      // are matched, action is complete (except for BB option)
      if (next === lastAggressor) {
        const isBBOption =
          gs.street === "PREFLOP" &&
          next === "BB" &&
          !actedThisStreet.includes("BB" as Position);
        if (!isBBOption) {
          streetComplete = true;
        }
      }
    }
  }

  return {
    street: gs.street,
    positions: gs.positions,
    activePositions,
    stacks: stacks as Record<Position, number>,
    bets: bets as Record<Position, number>,
    pot,
    toAct,
    lastAggressor,
    lastRaiseIncrement,
    actedThisStreet,
    history,
    allIn: allIn as Record<Position, boolean>,
    board: gs.board,
    blinds: gs.blinds,
    streetComplete,
  };
}
