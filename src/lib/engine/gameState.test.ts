// src/lib/engine/gameState.test.ts

import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  computeLegalActions,
  validateActionLegality,
  applyAction,
  parseActionId,
  type GameState,
} from "./gameState";
import type { Spot } from "./spot";
import type { Position } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make6MaxSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    schemaVersion: "1",
    spotId: "test-spot-1",
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1 },
    positions: ["SB", "BB", "UTG", "HJ", "CO", "BTN"] as Position[],
    stacksBb: {
      SB: 100, BB: 100, UTG: 100, HJ: 100, CO: 100, BTN: 100,
    } as Record<Position, number>,
    potBb: 0,
    board: [],
    history: [],
    heroToAct: "UTG" as Position,
    ...overrides,
  };
}

function makeFlopSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    schemaVersion: "1",
    spotId: "test-spot-flop",
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1 },
    positions: ["BB", "BTN"] as Position[],
    stacksBb: { BB: 95, BTN: 95 } as Record<Position, number>,
    potBb: 10,
    board: ["Ah", "Kd", "7c"],
    history: [],
    heroToAct: "BB" as Position,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseActionId
// ---------------------------------------------------------------------------

describe("parseActionId", () => {
  it("parses simple actions", () => {
    expect(parseActionId("FOLD")).toEqual({ type: "FOLD" });
    expect(parseActionId("CHECK")).toEqual({ type: "CHECK" });
    expect(parseActionId("CALL")).toEqual({ type: "CALL" });
    expect(parseActionId("ALL_IN")).toEqual({ type: "ALL_IN" });
  });

  it("parses sized BET", () => {
    expect(parseActionId("BET_3BB")).toEqual({ type: "BET", sizeBb: 3 });
    expect(parseActionId("BET_2.5BB")).toEqual({ type: "BET", sizeBb: 2.5 });
    expect(parseActionId("BET_75")).toEqual({ type: "BET", sizeBb: 75 });
  });

  it("parses sized RAISE", () => {
    expect(parseActionId("RAISE_6BB")).toEqual({ type: "RAISE", sizeBb: 6 });
    expect(parseActionId("RAISE_2.5")).toEqual({ type: "RAISE", sizeBb: 2.5 });
  });

  it("parses sized ALL_IN", () => {
    expect(parseActionId("ALL_IN_50BB")).toEqual({ type: "ALL_IN", sizeBb: 50 });
  });

  it("throws for unrecognized action", () => {
    expect(() => parseActionId("BLUFF")).toThrow("unrecognized actionId");
  });
});

// ---------------------------------------------------------------------------
// createInitialGameState
// ---------------------------------------------------------------------------

describe("createInitialGameState", () => {
  it("creates preflop state with correct blinds", () => {
    const gs = createInitialGameState(make6MaxSpot());

    expect(gs.street).toBe("PREFLOP");
    expect(gs.bets.SB).toBe(0.5);
    expect(gs.bets.BB).toBe(1);
    expect(gs.stacks.SB).toBe(99.5);
    expect(gs.stacks.BB).toBe(99);
  });

  it("sets preflop first-to-act as UTG", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(gs.toAct).toBe("UTG");
  });

  it("sets lastRaiseIncrement to BB for preflop", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(gs.lastRaiseIncrement).toBe(1);
  });

  it("sets lastAggressor to BB for preflop", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(gs.lastAggressor).toBe("BB");
  });

  it("all positions are active initially", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(gs.activePositions).toHaveLength(6);
  });

  it("creates flop state with pot from prior streets", () => {
    const gs = createInitialGameState(makeFlopSpot());

    expect(gs.street).toBe("FLOP");
    expect(gs.pot).toBe(10);
    expect(gs.bets.BB).toBe(0);
    expect(gs.bets.BTN).toBe(0);
  });

  it("sets postflop first-to-act as first active position left of BTN", () => {
    const gs = createInitialGameState(makeFlopSpot());
    // BB is first postflop (SB not in positions list)
    expect(gs.toAct).toBe("BB");
  });

  it("sets lastAggressor to null for postflop", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(gs.lastAggressor).toBeNull();
  });

  it("handles antes", () => {
    const gs = createInitialGameState(make6MaxSpot({
      blinds: { sb: 0.5, bb: 1, ante: 0.1 },
    }));

    // Each player posts 0.1 ante → 0.6 total ante in pot
    expect(gs.pot).toBeCloseTo(0.6, 4);
    // UTG: 100 - 0.1 ante = 99.9
    expect(gs.stacks.UTG).toBeCloseTo(99.9, 4);
  });

  it("preserves board and history from spot", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(gs.board).toEqual(["Ah", "Kd", "7c"]);
  });

  it("handles heads-up (2 players)", () => {
    const gs = createInitialGameState(make6MaxSpot({
      positions: ["SB", "BB"] as Position[],
      stacksBb: { SB: 100, BB: 100 } as Record<Position, number>,
    }));

    expect(gs.bets.SB).toBe(0.5);
    expect(gs.bets.BB).toBe(1);
    // Preflop heads-up: SB (BTN) acts first
    expect(gs.toAct).toBe("SB");
  });
});

// ---------------------------------------------------------------------------
// computeLegalActions — no bet facing
// ---------------------------------------------------------------------------

describe("computeLegalActions — no bet facing", () => {
  it("allows CHECK and BET on flop with no bet", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const legal = computeLegalActions(gs);

    expect(legal.canCheck).toBe(true);
    expect(legal.canBet).toBe(true);
    expect(legal.canFold).toBe(false);
    expect(legal.canCall).toBe(false);
    expect(legal.canRaise).toBe(false);
  });

  it("minBet is 1 BB", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const legal = computeLegalActions(gs);
    expect(legal.minBet).toBe(1);
  });

  it("maxBet is player's stack", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const legal = computeLegalActions(gs);
    expect(legal.maxBet).toBe(95);
  });
});

// ---------------------------------------------------------------------------
// computeLegalActions — facing a bet
// ---------------------------------------------------------------------------

describe("computeLegalActions — facing a bet", () => {
  it("allows FOLD, CALL, RAISE when facing a bet", () => {
    const gs = createInitialGameState(make6MaxSpot());
    // UTG faces the BB (1 BB bet)
    const legal = computeLegalActions(gs);

    expect(legal.canFold).toBe(true);
    expect(legal.canCall).toBe(true);
    expect(legal.canRaise).toBe(true);
    expect(legal.canCheck).toBe(false);
    expect(legal.canBet).toBe(false);
  });

  it("callAmount is the difference to high bet", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const legal = computeLegalActions(gs);
    // UTG bet = 0, high bet = 1 (BB), call = 1
    expect(legal.callAmount).toBe(1);
  });

  it("minRaise is currentBet + lastRaiseIncrement", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const legal = computeLegalActions(gs);
    // highBet = 1 (BB), lastRaiseIncrement = 1 (BB), minRaise = 1 + 1 = 2
    expect(legal.minRaise).toBe(2);
  });

  it("maxRaise is player stack + current bet (all-in)", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const legal = computeLegalActions(gs);
    // UTG stack = 100, UTG bet = 0, maxRaise = 100 + 0 = 100
    expect(legal.maxRaise).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeLegalActions — BB option
// ---------------------------------------------------------------------------

describe("computeLegalActions — BB option", () => {
  it("BB can check or raise when limped to", () => {
    let gs = createInitialGameState(make6MaxSpot());

    // Everyone calls (limps) to BB
    gs = applyAction(gs, "CALL"); // UTG
    gs = applyAction(gs, "CALL"); // HJ
    gs = applyAction(gs, "CALL"); // CO
    gs = applyAction(gs, "CALL"); // BTN
    gs = applyAction(gs, "CALL"); // SB

    // Now BB has the option
    expect(gs.toAct).toBe("BB");
    const legal = computeLegalActions(gs);

    expect(legal.canCheck).toBe(true);
    expect(legal.canRaise).toBe(true);
    expect(legal.canFold).toBe(false);
    expect(legal.canCall).toBe(false);
    expect(legal.canBet).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeLegalActions — edge cases
// ---------------------------------------------------------------------------

describe("computeLegalActions — edge cases", () => {
  it("returns no actions when street is complete", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const completed: GameState = { ...gs, streetComplete: true };
    const legal = computeLegalActions(completed);

    expect(legal.canCheck).toBe(false);
    expect(legal.canBet).toBe(false);
  });

  it("returns no actions for all-in player", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const allInState: GameState = {
      ...gs,
      allIn: { ...gs.allIn, BB: true },
    };
    const legal = computeLegalActions(allInState);

    expect(legal.canCheck).toBe(false);
    expect(legal.canBet).toBe(false);
  });

  it("short stack can't raise but can call", () => {
    const gs = createInitialGameState(make6MaxSpot({
      stacksBb: {
        SB: 100, BB: 100, UTG: 1.5, HJ: 100, CO: 100, BTN: 100,
      } as Record<Position, number>,
    }));
    // UTG has 1.5BB stack facing 1BB bet
    const legal = computeLegalActions(gs);

    expect(legal.canCall).toBe(true);
    expect(legal.callAmount).toBe(1);
    // After calling 1, only 0.5 left — can't make min raise of 2
    expect(legal.canRaise).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateActionLegality
// ---------------------------------------------------------------------------

describe("validateActionLegality", () => {
  it("CHECK is legal when no bet facing", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(validateActionLegality("CHECK", gs).legal).toBe(true);
  });

  it("CHECK is illegal when facing a bet", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const result = validateActionLegality("CHECK", gs);
    expect(result.legal).toBe(false);
    expect(result.reason).toContain("cannot check");
  });

  it("BET is legal when no bet facing with valid size", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(validateActionLegality("BET_5BB", gs).legal).toBe(true);
  });

  it("BET below minimum is illegal", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const result = validateActionLegality("BET_0.5BB", gs);
    expect(result.legal).toBe(false);
    expect(result.reason).toContain("below minimum");
  });

  it("BET above stack is illegal", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const result = validateActionLegality("BET_200BB", gs);
    expect(result.legal).toBe(false);
    expect(result.reason).toContain("exceeds stack");
  });

  it("FOLD is legal when facing a bet", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(validateActionLegality("FOLD", gs).legal).toBe(true);
  });

  it("FOLD is illegal when not facing a bet", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const result = validateActionLegality("FOLD", gs);
    expect(result.legal).toBe(false);
    expect(result.reason).toContain("check instead");
  });

  it("CALL is legal when facing a bet", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(validateActionLegality("CALL", gs).legal).toBe(true);
  });

  it("CALL is illegal when not facing a bet", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const result = validateActionLegality("CALL", gs);
    expect(result.legal).toBe(false);
    expect(result.reason).toContain("nothing to call");
  });

  it("RAISE below min raise is illegal", () => {
    const gs = createInitialGameState(make6MaxSpot());
    // minRaise = 2 (BB=1, increment=1)
    const result = validateActionLegality("RAISE_1.5BB", gs);
    expect(result.legal).toBe(false);
    expect(result.reason).toContain("below minimum");
  });

  it("RAISE at min raise is legal", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(validateActionLegality("RAISE_2BB", gs).legal).toBe(true);
  });

  it("ALL_IN is legal when facing a bet", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(validateActionLegality("ALL_IN", gs).legal).toBe(true);
  });

  it("ALL_IN is legal when not facing a bet (as a bet)", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(validateActionLegality("ALL_IN", gs).legal).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyAction
// ---------------------------------------------------------------------------

describe("applyAction", () => {
  it("FOLD removes position from active", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const next = applyAction(gs, "FOLD"); // UTG folds

    expect(next.activePositions).not.toContain("UTG");
    expect(next.activePositions).toHaveLength(5);
  });

  it("does not mutate original state", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const next = applyAction(gs, "FOLD");

    expect(gs.activePositions).toHaveLength(6);
    expect(next.activePositions).toHaveLength(5);
  });

  it("CALL moves chips from stack to bets", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const next = applyAction(gs, "CALL"); // UTG calls 1BB

    expect(next.bets.UTG).toBe(1);
    expect(next.stacks.UTG).toBe(99);
  });

  it("CHECK does not move chips", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const next = applyAction(gs, "CHECK");

    expect(next.bets.BB).toBe(0);
    expect(next.stacks.BB).toBe(95);
  });

  it("BET sets bet and reduces stack", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const next = applyAction(gs, "BET_5BB");

    expect(next.bets.BB).toBe(5);
    expect(next.stacks.BB).toBe(90);
    expect(next.lastAggressor).toBe("BB");
  });

  it("RAISE updates bets and lastRaiseIncrement", () => {
    const gs = createInitialGameState(make6MaxSpot());
    // UTG raises to 3BB (increment = 3 - 1 = 2)
    const next = applyAction(gs, "RAISE_3BB");

    expect(next.bets.UTG).toBe(3);
    expect(next.stacks.UTG).toBe(97);
    expect(next.lastAggressor).toBe("UTG");
    expect(next.lastRaiseIncrement).toBe(2); // 3 - 1 (current high)
  });

  it("advances toAct to next position", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const next = applyAction(gs, "FOLD"); // UTG folds

    expect(next.toAct).toBe("HJ");
  });

  it("skips folded players", () => {
    let gs = createInitialGameState(make6MaxSpot());
    gs = applyAction(gs, "FOLD"); // UTG
    gs = applyAction(gs, "FOLD"); // HJ

    expect(gs.toAct).toBe("CO");
  });

  it("tracks action history", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const next = applyAction(gs, "CALL");

    expect(next.history).toContain("CALL");
    expect(next.history.length).toBe(gs.history.length + 1);
  });

  it("ALL_IN sets allIn flag and zeros stack", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const next = applyAction(gs, "ALL_IN"); // UTG all-in

    expect(next.allIn.UTG).toBe(true);
    expect(next.stacks.UTG).toBe(0);
    expect(next.bets.UTG).toBe(100); // full stack
  });

  it("throws for illegal action", () => {
    const gs = createInitialGameState(makeFlopSpot());
    // Can't call when no bet facing
    expect(() => applyAction(gs, "CALL")).toThrow("illegal action");
  });

  it("completes street when all players check", () => {
    const gs = createInitialGameState(makeFlopSpot());
    let state = applyAction(gs, "CHECK"); // BB
    state = applyAction(state, "CHECK"); // BTN

    expect(state.streetComplete).toBe(true);
  });

  it("completes street when bet is called by all", () => {
    const gs = createInitialGameState(makeFlopSpot());
    let state = applyAction(gs, "BET_5BB"); // BB bets
    state = applyAction(state, "CALL"); // BTN calls

    expect(state.streetComplete).toBe(true);
  });

  it("everyone folds to one player completes street", () => {
    let gs = createInitialGameState(make6MaxSpot());
    gs = applyAction(gs, "FOLD"); // UTG
    gs = applyAction(gs, "FOLD"); // HJ
    gs = applyAction(gs, "FOLD"); // CO
    gs = applyAction(gs, "FOLD"); // BTN
    gs = applyAction(gs, "FOLD"); // SB

    // BB wins — only one active
    expect(gs.activePositions).toHaveLength(1);
    expect(gs.streetComplete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyAction — raise chain with min raise tracking
// ---------------------------------------------------------------------------

describe("applyAction — raise chain", () => {
  it("tracks min raise correctly through a raise chain", () => {
    let gs = createInitialGameState(make6MaxSpot());

    // UTG raises to 3 (increment = 3 - 1 = 2)
    gs = applyAction(gs, "RAISE_3BB");
    expect(gs.lastRaiseIncrement).toBe(2);

    // HJ 3bets to 10 (increment = 10 - 3 = 7)
    gs = applyAction(gs, "RAISE_10BB");
    expect(gs.lastRaiseIncrement).toBe(7);

    // CO wants to 4bet — min raise = 10 + 7 = 17
    const legal = computeLegalActions(gs);
    expect(legal.minRaise).toBe(17);
  });
});
