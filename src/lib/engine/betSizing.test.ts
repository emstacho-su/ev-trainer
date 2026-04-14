// src/lib/engine/betSizing.test.ts

import { describe, it, expect } from "vitest";
import {
  calculateMinBet,
  calculateMinRaise,
  calculateMaxBet,
  calculateMaxRaise,
  calculatePotSizedBet,
  getStandardBetSizes,
  getStandardRaiseSizes,
  isAllIn,
  doesAllInReopenAction,
} from "./betSizing";
import { createInitialGameState, applyAction, type GameState } from "./gameState";
import type { Spot } from "./spot";
import type { Position } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make6MaxSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    schemaVersion: "1",
    spotId: "test-bet-sizing",
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
    spotId: "test-flop-sizing",
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
// calculateMinBet
// ---------------------------------------------------------------------------

describe("calculateMinBet", () => {
  it("returns 1 BB for standard opening bet", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(calculateMinBet(gs)).toBe(1);
  });

  it("returns stack when stack < 1 BB", () => {
    const gs = createInitialGameState(makeFlopSpot({
      stacksBb: { BB: 0.5, BTN: 95 } as Record<Position, number>,
    }));
    expect(calculateMinBet(gs)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// calculateMinRaise
// ---------------------------------------------------------------------------

describe("calculateMinRaise", () => {
  it("preflop min raise = BB + BB = 2BB", () => {
    const gs = createInitialGameState(make6MaxSpot());
    // highBet = 1 (BB), lastRaiseIncrement = 1 → minRaise = 1 + 1 = 2
    expect(calculateMinRaise(gs)).toBe(2);
  });

  it("after open to 3BB: min 3bet = 3 + 2 = 5BB", () => {
    let gs = createInitialGameState(make6MaxSpot());
    gs = applyAction(gs, "RAISE_3BB"); // UTG opens to 3 (increment = 2)

    // HJ: minRaise = 3 + 2 = 5
    expect(calculateMinRaise(gs)).toBe(5);
  });

  it("after 3bet to 10BB from 3BB: min 4bet = 10 + 7 = 17BB", () => {
    let gs = createInitialGameState(make6MaxSpot());
    gs = applyAction(gs, "RAISE_3BB");  // UTG to 3 (increment = 2)
    gs = applyAction(gs, "RAISE_10BB"); // HJ to 10 (increment = 7)

    // CO: minRaise = 10 + 7 = 17
    expect(calculateMinRaise(gs)).toBe(17);
  });

  it("caps at player stack when can't afford full raise", () => {
    const gs = createInitialGameState(make6MaxSpot({
      stacksBb: {
        SB: 100, BB: 100, UTG: 100, HJ: 4, CO: 100, BTN: 100,
      } as Record<Position, number>,
    }));

    let state = applyAction(gs, "RAISE_3BB"); // UTG to 3
    // HJ has 4BB, current bet = 0, min raise = 5 but stack = 4
    expect(calculateMinRaise(state)).toBe(4);
  });

  it("first bet on flop: min raise = bet + bet (2x)", () => {
    let gs = createInitialGameState(makeFlopSpot());
    gs = applyAction(gs, "BET_5BB"); // BB bets 5

    // BTN: highBet = 5, lastRaiseIncrement = 5, minRaise = 5 + 5 = 10
    expect(calculateMinRaise(gs)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// calculateMaxBet / calculateMaxRaise
// ---------------------------------------------------------------------------

describe("calculateMaxBet", () => {
  it("returns player's remaining stack", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(calculateMaxBet(gs)).toBe(95);
  });

  it("returns 0 for all-in player", () => {
    const gs = createInitialGameState(makeFlopSpot({
      stacksBb: { BB: 0, BTN: 95 } as Record<Position, number>,
    }));
    expect(calculateMaxBet(gs)).toBe(0);
  });
});

describe("calculateMaxRaise", () => {
  it("returns stack + current bet", () => {
    const gs = createInitialGameState(make6MaxSpot());
    // UTG: stack=100, bet=0 → maxRaise = 100
    expect(calculateMaxRaise(gs)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculatePotSizedBet
// ---------------------------------------------------------------------------

describe("calculatePotSizedBet", () => {
  it("equals pot when no bet facing", () => {
    const gs = createInitialGameState(makeFlopSpot());
    // pot = 10, no bets → potBet = 10
    expect(calculatePotSizedBet(gs)).toBe(10);
  });

  it("includes call amount when facing a bet", () => {
    let gs = createInitialGameState(makeFlopSpot());
    gs = applyAction(gs, "BET_5BB"); // BB bets 5

    // BTN faces 5BB bet. pot = 10, total street bets = 5, totalPot = 15
    // callAmount = 5, potBet = 15 + 5 = 20
    expect(calculatePotSizedBet(gs)).toBe(20);
  });

  it("caps at stack", () => {
    const gs = createInitialGameState(makeFlopSpot({
      stacksBb: { BB: 5, BTN: 95 } as Record<Position, number>,
    }));
    // potBet would be 10 but BB only has 5
    expect(calculatePotSizedBet(gs)).toBe(5);
  });

  it("includes dead money from prior streets", () => {
    const gs = createInitialGameState(makeFlopSpot({
      potBb: 25,
    }));
    // pot = 25, no street bets → potBet = 25
    expect(calculatePotSizedBet(gs)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// getStandardBetSizes
// ---------------------------------------------------------------------------

describe("getStandardBetSizes", () => {
  it("returns standard pot-percentage sizes", () => {
    const gs = createInitialGameState(makeFlopSpot());
    const sizes = getStandardBetSizes(gs);

    // pot = 10. Expected: 2.5 (25%), 3.3 (33%), 5 (50%), 7.5 (75%), 10 (100%), 15 (150%)
    expect(sizes.length).toBeGreaterThanOrEqual(5);
    expect(sizes[0]).toBeCloseTo(2.5, 1);
    expect(sizes).toContainEqual(expect.closeTo(5, 1));
  });

  it("filters sizes below min bet", () => {
    const gs = createInitialGameState(makeFlopSpot({
      potBb: 2,
      stacksBb: { BB: 95, BTN: 95 } as Record<Position, number>,
    }));
    const sizes = getStandardBetSizes(gs);

    // pot = 2. 25% = 0.5 which is below 1BB min. Should be filtered.
    expect(sizes.every((s) => s >= 1 - 0.01)).toBe(true);
  });

  it("includes all-in when stack is relevant", () => {
    const gs = createInitialGameState(makeFlopSpot({
      stacksBb: { BB: 8, BTN: 95 } as Record<Position, number>,
    }));
    const sizes = getStandardBetSizes(gs);

    // Stack is 8, should include 8 (all-in)
    expect(sizes).toContainEqual(expect.closeTo(8, 0.1));
  });

  it("returns empty for zero stack", () => {
    const gs = createInitialGameState(makeFlopSpot({
      stacksBb: { BB: 0, BTN: 95 } as Record<Position, number>,
    }));
    const sizes = getStandardBetSizes(gs);
    expect(sizes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getStandardRaiseSizes
// ---------------------------------------------------------------------------

describe("getStandardRaiseSizes", () => {
  it("returns raise multiples of current bet", () => {
    let gs = createInitialGameState(makeFlopSpot());
    gs = applyAction(gs, "BET_5BB"); // BB bets 5

    const sizes = getStandardRaiseSizes(gs);
    // 2x = 10, 2.5x = 12.5, 3x = 15
    expect(sizes).toContainEqual(expect.closeTo(10, 0.1));
    expect(sizes).toContainEqual(expect.closeTo(12.5, 0.1));
    expect(sizes).toContainEqual(expect.closeTo(15, 0.1));
  });

  it("includes all-in", () => {
    let gs = createInitialGameState(makeFlopSpot());
    gs = applyAction(gs, "BET_5BB");

    const sizes = getStandardRaiseSizes(gs);
    // BTN stack=95, bet=0 → maxRaise = 95
    expect(sizes).toContainEqual(expect.closeTo(95, 0.1));
  });
});

// ---------------------------------------------------------------------------
// isAllIn
// ---------------------------------------------------------------------------

describe("isAllIn", () => {
  it("returns true when bet equals stack", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(isAllIn(95, gs)).toBe(true);
  });

  it("returns false for partial bet", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(isAllIn(50, gs)).toBe(false);
  });

  it("returns true when bet exceeds stack", () => {
    const gs = createInitialGameState(makeFlopSpot());
    expect(isAllIn(100, gs)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// doesAllInReopenAction
// ---------------------------------------------------------------------------

describe("doesAllInReopenAction", () => {
  it("full raise reopens action", () => {
    // Player A bets 100. Player B all-in 250. Increment = 150 >= 100.
    expect(doesAllInReopenAction(250, 100, 100)).toBe(true);
  });

  it("incomplete raise does NOT reopen action", () => {
    // Player A bets 100. Player B all-in 140. Increment = 40 < 100.
    expect(doesAllInReopenAction(140, 100, 100)).toBe(false);
  });

  it("exact minimum reopens action", () => {
    // Player A bets 100. Player B all-in 200. Increment = 100 == 100.
    expect(doesAllInReopenAction(200, 100, 100)).toBe(true);
  });

  it("handles preflop open scenario", () => {
    // BB = 1. UTG all-in 1.5. Increment = 0.5 < 1 (BB increment).
    expect(doesAllInReopenAction(1.5, 1, 1)).toBe(false);
  });

  it("handles preflop full raise", () => {
    // BB = 1. UTG all-in 3. Increment = 2 >= 1.
    expect(doesAllInReopenAction(3, 1, 1)).toBe(true);
  });
});
