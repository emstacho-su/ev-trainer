// src/lib/engine/handSession.ts
// Multi-street hand progression layered on top of applyAction.
//
// The low-level engine only advances *within* a street — once everyone has
// acted and bets are equalized, streetComplete flips true. This module
// handles the next question: "what happens next?"
//
//   - If one active player remains → the hand is over, they win the pot.
//   - If 2+ players remain, no more streets → showdown (resolved externally).
//   - If 2+ players remain, streets remaining → deal next street, reset
//     current-street bets into the pot, set toAct to the first active
//     non-all-in player in postflop order, clear actedThisStreet.
//   - If 2+ players remain but only one (or zero) can still act → run it
//     out: deal all remaining board cards at once, then showdown.

import { applyAction, type GameState } from "./gameState";
import type { ActionId, Position, Street } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HandPhase =
  | "IN_PROGRESS"      // Player can still act this street
  | "STREET_COMPLETE"  // Street closed, ready to advance
  | "RUNOUT"           // No more voluntary action — deal remaining board
  | "HAND_OVER";       // Single player left OR river action complete

export interface HandStatus {
  readonly phase: HandPhase;
  readonly winner: Position | null;   // Only set when hand ends on a fold chain
  readonly finalPot: number;
  readonly activePlayers: readonly Position[];
}

export interface AdvanceStreetResult {
  readonly state: GameState;
  readonly dealt: readonly string[];  // The cards that were just dealt
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POSTFLOP_ORDER: readonly Position[] = ["SB", "BB", "UTG", "HJ", "CO", "BTN"];

function sumBets(gs: GameState): number {
  let s = 0;
  for (const p of gs.positions) s += gs.bets[p] ?? 0;
  return s;
}

function nextStreet(s: Street): Street | null {
  if (s === "PREFLOP") return "FLOP";
  if (s === "FLOP") return "TURN";
  if (s === "TURN") return "RIVER";
  return null; // RIVER → no next street
}

function cardsNeededForStreet(s: Street): number {
  if (s === "FLOP") return 3;
  if (s === "TURN") return 4;
  if (s === "RIVER") return 5;
  return 0;
}

/** Cards that must be added to reach the next street from the current board. */
function cardsToDealForNext(currentBoard: readonly string[], next: Street): number {
  return cardsNeededForStreet(next) - currentBoard.length;
}

function canAct(gs: GameState, pos: Position): boolean {
  return gs.activePositions.includes(pos) && !gs.allIn[pos];
}

function firstPostflopActor(gs: GameState): Position | null {
  for (const p of POSTFLOP_ORDER) {
    if (gs.positions.includes(p) && canAct(gs, p)) return p;
  }
  return null;
}

// ---------------------------------------------------------------------------
// handStatus
// ---------------------------------------------------------------------------

/** Classify the current state into a HandPhase. Does not mutate. */
export function handStatus(gs: GameState): HandStatus {
  const active = gs.activePositions;
  const totalPot = gs.pot + sumBets(gs);

  // Single player left → they win (fold chain)
  if (active.length <= 1) {
    return {
      phase: "HAND_OVER",
      winner: active[0] ?? null,
      finalPot: totalPot,
      activePlayers: active,
    };
  }

  // 2+ players remaining
  const canStillAct = active.filter((p) => !gs.allIn[p]);

  if (!gs.streetComplete) {
    return {
      phase: "IN_PROGRESS",
      winner: null,
      finalPot: totalPot,
      activePlayers: active,
    };
  }

  // Street complete AND 2+ players remain.
  // If only 0 or 1 players can still act (everyone else all-in) → runout.
  if (canStillAct.length <= 1) {
    const isRiver = gs.street === "RIVER";
    return {
      phase: isRiver ? "HAND_OVER" : "RUNOUT",
      winner: null,
      finalPot: totalPot,
      activePlayers: active,
    };
  }

  // 2+ players can still act but street is complete → ready to advance.
  if (gs.street === "RIVER") {
    return {
      phase: "HAND_OVER",
      winner: null,
      finalPot: totalPot,
      activePlayers: active,
    };
  }

  return {
    phase: "STREET_COMPLETE",
    winner: null,
    finalPot: totalPot,
    activePlayers: active,
  };
}

// ---------------------------------------------------------------------------
// advanceStreet
// ---------------------------------------------------------------------------

/**
 * Transition from a complete street to the next one. Deals the given cards
 * onto the board, sweeps current-street bets into the pot, and resets state
 * for the new street.
 *
 * Throws if the hand isn't in STREET_COMPLETE phase or if the wrong number
 * of cards was supplied for the next street.
 */
export function advanceStreet(gs: GameState, cardsToDeal: readonly string[]): AdvanceStreetResult {
  const status = handStatus(gs);
  if (status.phase !== "STREET_COMPLETE") {
    throw new Error(`advanceStreet called in phase ${status.phase}; must be STREET_COMPLETE`);
  }

  const next = nextStreet(gs.street);
  if (!next) {
    throw new Error("cannot advance past RIVER");
  }

  const needed = cardsToDealForNext(gs.board, next);
  if (cardsToDeal.length !== needed) {
    throw new Error(
      `advanceStreet: expected ${needed} card(s) for ${next}, got ${cardsToDeal.length}`,
    );
  }

  // Sweep bets into pot, reset per-street state.
  const bettedThisStreet = sumBets(gs);
  const bets: Record<string, number> = {};
  for (const p of gs.positions) bets[p] = 0;

  const toAct = firstPostflopActor(gs);
  if (!toAct) {
    throw new Error("advanceStreet: no eligible actor for next street");
  }

  const state: GameState = {
    ...gs,
    street: next,
    board: [...gs.board, ...cardsToDeal],
    pot: gs.pot + bettedThisStreet,
    bets: bets as Record<Position, number>,
    actedThisStreet: [],
    toAct,
    lastAggressor: null,
    lastRaiseIncrement: gs.blinds.bb,
    streetComplete: false,
    // Reopen rights for everyone who can still act.
    raiseRights: Object.fromEntries(
      gs.positions.map((p) => [p, canAct(gs, p)]),
    ) as Record<Position, boolean>,
  };

  return { state, dealt: cardsToDeal };
}

// ---------------------------------------------------------------------------
// runout
// ---------------------------------------------------------------------------

/**
 * Deal all remaining board cards at once. Used when no voluntary action
 * remains (everyone except at most one player is all-in). Returns a final
 * state on the RIVER. Throws if the hand isn't in RUNOUT phase.
 */
export function runout(gs: GameState, cardsToDeal: readonly string[]): GameState {
  const status = handStatus(gs);
  if (status.phase !== "RUNOUT") {
    throw new Error(`runout called in phase ${status.phase}; must be RUNOUT`);
  }

  const needed = cardsNeededForStreet("RIVER") - gs.board.length;
  if (cardsToDeal.length !== needed) {
    throw new Error(
      `runout: expected ${needed} card(s) to complete to RIVER, got ${cardsToDeal.length}`,
    );
  }

  const bettedThisStreet = sumBets(gs);
  const bets: Record<string, number> = {};
  for (const p of gs.positions) bets[p] = 0;

  return {
    ...gs,
    street: "RIVER",
    board: [...gs.board, ...cardsToDeal],
    pot: gs.pot + bettedThisStreet,
    bets: bets as Record<Position, number>,
    actedThisStreet: [],
    streetComplete: true,
  };
}

// ---------------------------------------------------------------------------
// playAction — convenience wrapper around applyAction
// ---------------------------------------------------------------------------

/**
 * Apply an action and return the updated state along with the new status.
 * The status tells the caller what to do next (keep going, advance street,
 * run it out, or end the hand).
 */
export function playAction(gs: GameState, actionId: ActionId): { state: GameState; status: HandStatus } {
  const state = applyAction(gs, actionId);
  return { state, status: handStatus(state) };
}
