// src/lib/engine/pokerRules.test.ts
// End-to-end rule tests that emulate how a trainer would actually be played.
// Covers TDA rules and gotchas that unit tests of individual functions miss.

import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  computeLegalActions,
  validateActionLegality,
  applyAction,
} from "./gameState";
import type { Spot } from "./spot";
import type { Position } from "./types";

function make6MaxSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    schemaVersion: "1",
    spotId: "rules-spot",
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

// ---------------------------------------------------------------------------
// TDA Rule 41: under-min all-in does NOT reopen betting for prior actors
// ---------------------------------------------------------------------------

describe("Rule: under-min all-in does not reopen action for prior actors", () => {
  it("prior raiser cannot re-raise a short all-in", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        stacksBb: {
          SB: 100, BB: 100, UTG: 100, HJ: 8, CO: 100, BTN: 100,
        } as Record<Position, number>,
      }),
    );

    // UTG raises to 5 (increment = 4, new minRaise baseline)
    gs = applyAction(gs, "RAISE_5BB");
    expect(gs.lastRaiseIncrement).toBe(4);

    // HJ all-in for 8 — increment = 3, which is less than 4 (short all-in)
    gs = applyAction(gs, "ALL_IN");
    expect(gs.allIn.HJ).toBe(true);
    expect(gs.bets.HJ).toBe(8);

    // CO calls
    gs = applyAction(gs, "CALL");
    gs = applyAction(gs, "FOLD"); // BTN
    gs = applyAction(gs, "FOLD"); // SB
    gs = applyAction(gs, "FOLD"); // BB

    // Action returns to UTG — UTG should only be able to CALL or FOLD, NOT raise
    expect(gs.toAct).toBe("UTG");
    const legal = computeLegalActions(gs);
    expect(legal.canCall).toBe(true);
    expect(legal.canFold).toBe(true);
    expect(legal.canRaise).toBe(false);

    // Attempting to raise throws
    expect(() => applyAction(gs, "RAISE_20BB")).toThrow("illegal action");
  });

  it("full-raise all-in DOES reopen action for prior raiser", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        stacksBb: {
          SB: 100, BB: 100, UTG: 100, HJ: 12, CO: 100, BTN: 100,
        } as Record<Position, number>,
      }),
    );

    // UTG raises to 5 (increment = 4)
    gs = applyAction(gs, "RAISE_5BB");

    // HJ all-in for 12 — increment = 7, which is >= 4 (full raise)
    gs = applyAction(gs, "ALL_IN");
    expect(gs.allIn.HJ).toBe(true);

    // Fold around to UTG
    gs = applyAction(gs, "FOLD"); // CO
    gs = applyAction(gs, "FOLD"); // BTN
    gs = applyAction(gs, "FOLD"); // SB
    gs = applyAction(gs, "FOLD"); // BB

    // Action returns to UTG — this time UTG CAN raise (HJ's all-in was a full raise)
    expect(gs.toAct).toBe("UTG");
    const legal = computeLegalActions(gs);
    expect(legal.canRaise).toBe(true);
  });

  it("new actor (not yet acted) CAN raise after short all-in", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        stacksBb: {
          SB: 100, BB: 100, UTG: 100, HJ: 8, CO: 100, BTN: 100,
        } as Record<Position, number>,
      }),
    );

    // UTG raises to 5 (increment = 4)
    gs = applyAction(gs, "RAISE_5BB");

    // HJ short all-in for 8 (increment = 3)
    gs = applyAction(gs, "ALL_IN");

    // CO hasn't acted yet — CO should be able to raise
    expect(gs.toAct).toBe("CO");
    const legal = computeLegalActions(gs);
    expect(legal.canRaise).toBe(true);
  });

  it("prior actor can still ALL_IN even when standard raise is locked", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        stacksBb: {
          SB: 100, BB: 100, UTG: 100, HJ: 8, CO: 100, BTN: 100,
        } as Record<Position, number>,
      }),
    );

    gs = applyAction(gs, "RAISE_5BB"); // UTG
    gs = applyAction(gs, "ALL_IN"); // HJ short all-in
    gs = applyAction(gs, "FOLD"); // CO
    gs = applyAction(gs, "FOLD"); // BTN
    gs = applyAction(gs, "FOLD"); // SB
    gs = applyAction(gs, "FOLD"); // BB

    // UTG facing HJ's short all-in — raise is locked but ALL_IN still legal
    expect(gs.toAct).toBe("UTG");
    expect(validateActionLegality("ALL_IN", gs).legal).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multi-street walkthrough emulating a trainer session
// ---------------------------------------------------------------------------

describe("Walkthrough: a typical trainer session hand", () => {
  it("plays out UTG open → BTN 3bet → UTG call flop check-raise line", () => {
    let gs = createInitialGameState(make6MaxSpot());

    // Preflop: UTG opens, folds to BTN 3-bets, folds to UTG calls
    gs = applyAction(gs, "RAISE_2.5BB"); // UTG opens 2.5x
    expect(gs.toAct).toBe("HJ");
    expect(gs.lastRaiseIncrement).toBe(1.5); // 2.5 - 1

    gs = applyAction(gs, "FOLD"); // HJ
    gs = applyAction(gs, "FOLD"); // CO
    gs = applyAction(gs, "RAISE_8BB"); // BTN 3bets to 8
    expect(gs.lastRaiseIncrement).toBe(5.5); // 8 - 2.5

    gs = applyAction(gs, "FOLD"); // SB
    gs = applyAction(gs, "FOLD"); // BB
    gs = applyAction(gs, "CALL"); // UTG calls 3bet

    expect(gs.streetComplete).toBe(true);
    expect(gs.bets.UTG).toBe(8);
    expect(gs.bets.BTN).toBe(8);
  });

  it("respects min-raise in a 4-bet sequence", () => {
    let gs = createInitialGameState(make6MaxSpot());

    gs = applyAction(gs, "RAISE_3BB"); // UTG: incr = 2
    gs = applyAction(gs, "RAISE_10BB"); // HJ 3bet: incr = 7

    // CO wants to 4bet — minimum is 10 + 7 = 17
    const legal = computeLegalActions(gs);
    expect(legal.minRaise).toBe(17);

    // 4-bet to 16 is illegal
    expect(validateActionLegality("RAISE_16BB", gs).legal).toBe(false);
    // 4-bet to 17 is legal
    expect(validateActionLegality("RAISE_17BB", gs).legal).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stack-based edge cases
// ---------------------------------------------------------------------------

describe("Rule: short stack scenarios", () => {
  it("player with exactly call amount can only call", () => {
    const gs = createInitialGameState(
      make6MaxSpot({
        stacksBb: {
          SB: 100, BB: 100, UTG: 1, HJ: 100, CO: 100, BTN: 100,
        } as Record<Position, number>,
      }),
    );

    // UTG has 1 BB, facing 1 BB to call
    const legal = computeLegalActions(gs);
    expect(legal.canCall).toBe(true);
    expect(legal.callAmount).toBe(1);
    expect(legal.canRaise).toBe(false);
  });

  it("calling all-in zeroes stack and flags all-in", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        stacksBb: {
          SB: 100, BB: 100, UTG: 1, HJ: 100, CO: 100, BTN: 100,
        } as Record<Position, number>,
      }),
    );

    gs = applyAction(gs, "CALL"); // UTG calls 1 BB — all-in
    expect(gs.stacks.UTG).toBe(0);
    expect(gs.allIn.UTG).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Preflop BB option nuances
// ---------------------------------------------------------------------------

describe("Rule: BB option", () => {
  it("BB gets option after SB completes (limp)", () => {
    let gs = createInitialGameState(make6MaxSpot());

    // Folds around to SB who completes (calls 0.5 more for total 1)
    gs = applyAction(gs, "FOLD"); // UTG
    gs = applyAction(gs, "FOLD"); // HJ
    gs = applyAction(gs, "FOLD"); // CO
    gs = applyAction(gs, "FOLD"); // BTN
    gs = applyAction(gs, "CALL"); // SB completes

    expect(gs.toAct).toBe("BB");
    const legal = computeLegalActions(gs);
    expect(legal.canCheck).toBe(true);
    expect(legal.canRaise).toBe(true);
  });

  it("BB check completes the preflop street", () => {
    let gs = createInitialGameState(make6MaxSpot());

    gs = applyAction(gs, "FOLD"); // UTG
    gs = applyAction(gs, "FOLD"); // HJ
    gs = applyAction(gs, "FOLD"); // CO
    gs = applyAction(gs, "FOLD"); // BTN
    gs = applyAction(gs, "CALL"); // SB completes
    gs = applyAction(gs, "CHECK"); // BB checks

    expect(gs.streetComplete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Heads-up specific order
// ---------------------------------------------------------------------------

describe("Rule: heads-up positions", () => {
  it("heads-up preflop: SB acts first, BB acts last", () => {
    const gs = createInitialGameState(
      make6MaxSpot({
        positions: ["SB", "BB"] as Position[],
        stacksBb: { SB: 100, BB: 100 } as Record<Position, number>,
      }),
    );

    expect(gs.toAct).toBe("SB");
  });

  it("heads-up: SB raise, BB call completes the street", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        positions: ["SB", "BB"] as Position[],
        stacksBb: { SB: 100, BB: 100 } as Record<Position, number>,
      }),
    );

    gs = applyAction(gs, "RAISE_3BB"); // SB opens 3x
    expect(gs.toAct).toBe("BB");

    gs = applyAction(gs, "CALL");
    expect(gs.streetComplete).toBe(true);
  });
});
