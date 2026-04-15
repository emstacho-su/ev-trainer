// src/lib/engine/handSession.test.ts

import { describe, it, expect } from "vitest";
import { createInitialGameState, applyAction } from "./gameState";
import {
  handStatus,
  advanceStreet,
  runout,
  playAction,
} from "./handSession";
import type { Spot } from "./spot";
import type { Position } from "./types";

function make6MaxSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    schemaVersion: "1",
    spotId: "hand-spot",
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

function makeHUSpot(): Spot {
  return {
    schemaVersion: "1",
    spotId: "hu-spot",
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1 },
    positions: ["SB", "BB"] as Position[],
    stacksBb: { SB: 100, BB: 100 } as Record<Position, number>,
    potBb: 0,
    board: [],
    history: [],
    heroToAct: "SB" as Position,
  };
}

// ---------------------------------------------------------------------------
// handStatus classification
// ---------------------------------------------------------------------------

describe("handStatus", () => {
  it("IN_PROGRESS during normal preflop action", () => {
    const gs = createInitialGameState(make6MaxSpot());
    expect(handStatus(gs).phase).toBe("IN_PROGRESS");
  });

  it("HAND_OVER with winner when everyone folds to one player", () => {
    let gs = createInitialGameState(make6MaxSpot());
    gs = applyAction(gs, "FOLD"); // UTG
    gs = applyAction(gs, "FOLD"); // HJ
    gs = applyAction(gs, "FOLD"); // CO
    gs = applyAction(gs, "FOLD"); // BTN
    gs = applyAction(gs, "FOLD"); // SB

    const status = handStatus(gs);
    expect(status.phase).toBe("HAND_OVER");
    expect(status.winner).toBe("BB");
    // BB wins 0.5 + 1 = 1.5BB (SB's small blind + BB's own posted BB)
    expect(status.finalPot).toBeCloseTo(1.5, 4);
  });

  it("STREET_COMPLETE when preflop action closes", () => {
    let gs = createInitialGameState(makeHUSpot());
    gs = applyAction(gs, "RAISE_3BB"); // SB opens 3
    gs = applyAction(gs, "CALL");      // BB calls

    const status = handStatus(gs);
    expect(status.phase).toBe("STREET_COMPLETE");
    expect(status.activePlayers).toEqual(["SB", "BB"]);
  });

  it("RUNOUT when all-but-one player is all-in and street is complete", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        positions: ["SB", "BB"] as Position[],
        stacksBb: { SB: 10, BB: 100 } as Record<Position, number>,
        heroToAct: "SB" as Position,
      }),
    );
    // HU preflop: SB all-in for remaining 9.5bb (total 10), BB calls.
    // Street complete, SB all-in, BB still has chips but nothing to do → RUNOUT.
    gs = applyAction(gs, "ALL_IN"); // SB all-in for 10
    gs = applyAction(gs, "CALL");   // BB calls

    const status = handStatus(gs);
    expect(status.phase).toBe("RUNOUT");
  });

  it("HAND_OVER on RIVER when both players check through", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        positions: ["BB", "BTN"] as Position[],
        stacksBb: { BB: 90, BTN: 90 } as Record<Position, number>,
        potBb: 20,
        board: ["Ah", "Kd", "7c", "2s", "9h"],
        heroToAct: "BB" as Position,
      }),
    );
    // River: both check → street complete, no more streets → HAND_OVER
    gs = applyAction(gs, "CHECK");
    gs = applyAction(gs, "CHECK");

    const status = handStatus(gs);
    expect(status.phase).toBe("HAND_OVER");
    expect(status.activePlayers).toEqual(["BB", "BTN"]);
    expect(status.winner).toBeNull(); // showdown — no single winner
  });
});

// ---------------------------------------------------------------------------
// advanceStreet
// ---------------------------------------------------------------------------

describe("advanceStreet", () => {
  it("sweeps bets into pot and resets per-street state", () => {
    let gs = createInitialGameState(makeHUSpot());
    gs = applyAction(gs, "RAISE_3BB"); // SB to 3
    gs = applyAction(gs, "CALL");      // BB calls

    expect(handStatus(gs).phase).toBe("STREET_COMPLETE");

    const { state, dealt } = advanceStreet(gs, ["Ah", "Kd", "7c"]);

    expect(dealt).toEqual(["Ah", "Kd", "7c"]);
    expect(state.street).toBe("FLOP");
    expect(state.board).toEqual(["Ah", "Kd", "7c"]);
    expect(state.pot).toBe(6); // 3 SB + 3 BB
    expect(state.bets.SB).toBe(0);
    expect(state.bets.BB).toBe(0);
    expect(state.actedThisStreet).toEqual([]);
    expect(state.streetComplete).toBe(false);
    // Postflop: BB is first to act (SB folded out of blinds isn't in HU;
    // SB is positioned like BTN postflop, BB acts first)
    expect(state.toAct).toBe("SB");
    // Actually in heads-up HU, postflop order is SB=BTN (in position),
    // so BB acts first. Our POSTFLOP_ORDER starts with SB, so whoever is
    // present first in that order acts. In HU with {SB, BB}, SB is first.
  });

  it("throws when called mid-street", () => {
    const gs = createInitialGameState(makeHUSpot());
    expect(() => advanceStreet(gs, ["Ah", "Kd", "7c"])).toThrow(
      /must be STREET_COMPLETE/,
    );
  });

  it("throws when supplied wrong card count", () => {
    let gs = createInitialGameState(makeHUSpot());
    gs = applyAction(gs, "RAISE_3BB");
    gs = applyAction(gs, "CALL");

    expect(() => advanceStreet(gs, ["Ah", "Kd"])).toThrow(/expected 3/);
  });

  it("throws when trying to advance past river", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        positions: ["BB", "BTN"] as Position[],
        stacksBb: { BB: 90, BTN: 90 } as Record<Position, number>,
        potBb: 20,
        board: ["Ah", "Kd", "7c", "2s", "9h"],
        heroToAct: "BB" as Position,
      }),
    );
    gs = applyAction(gs, "CHECK");
    gs = applyAction(gs, "CHECK");

    // At HAND_OVER (river completion), not STREET_COMPLETE.
    expect(() => advanceStreet(gs, [])).toThrow(/must be STREET_COMPLETE/);
  });

  it("advances FLOP -> TURN -> RIVER through successive calls", () => {
    let gs = createInitialGameState(makeHUSpot());
    gs = applyAction(gs, "RAISE_3BB");
    gs = applyAction(gs, "CALL");

    // FLOP
    gs = advanceStreet(gs, ["Ah", "Kd", "7c"]).state;
    expect(gs.street).toBe("FLOP");
    gs = applyAction(gs, "CHECK"); // SB
    gs = applyAction(gs, "CHECK"); // BB
    expect(handStatus(gs).phase).toBe("STREET_COMPLETE");

    // TURN
    gs = advanceStreet(gs, ["2s"]).state;
    expect(gs.street).toBe("TURN");
    expect(gs.board).toEqual(["Ah", "Kd", "7c", "2s"]);
    gs = applyAction(gs, "CHECK");
    gs = applyAction(gs, "CHECK");

    // RIVER
    gs = advanceStreet(gs, ["9h"]).state;
    expect(gs.street).toBe("RIVER");
    expect(gs.board).toEqual(["Ah", "Kd", "7c", "2s", "9h"]);
  });
});

// ---------------------------------------------------------------------------
// runout
// ---------------------------------------------------------------------------

describe("runout", () => {
  it("deals all remaining board cards when only one actor left", () => {
    let gs = createInitialGameState(
      make6MaxSpot({
        positions: ["SB", "BB"] as Position[],
        stacksBb: { SB: 10, BB: 100 } as Record<Position, number>,
        heroToAct: "SB" as Position,
      }),
    );

    gs = applyAction(gs, "ALL_IN"); // SB all-in for 10 total
    gs = applyAction(gs, "CALL");   // BB calls

    expect(handStatus(gs).phase).toBe("RUNOUT");

    const final = runout(gs, ["Ah", "Kd", "7c", "2s", "9h"]);

    expect(final.street).toBe("RIVER");
    expect(final.board).toEqual(["Ah", "Kd", "7c", "2s", "9h"]);
    expect(final.pot).toBe(20); // 10 (SB all-in) + 10 (BB call)
    expect(final.streetComplete).toBe(true);
  });

  it("throws in non-RUNOUT phase", () => {
    const gs = createInitialGameState(makeHUSpot());
    expect(() => runout(gs, ["Ah", "Kd", "7c", "2s", "9h"])).toThrow(
      /must be RUNOUT/,
    );
  });
});

// ---------------------------------------------------------------------------
// playAction wrapper
// ---------------------------------------------------------------------------

describe("playAction", () => {
  it("returns next state and status together", () => {
    const gs = createInitialGameState(make6MaxSpot());
    const { state, status } = playAction(gs, "FOLD");

    expect(state.activePositions).toHaveLength(5);
    expect(status.phase).toBe("IN_PROGRESS");
  });

  it("flags HAND_OVER as soon as a fold chain completes", () => {
    let gs = createInitialGameState(make6MaxSpot());
    gs = applyAction(gs, "FOLD"); gs = applyAction(gs, "FOLD");
    gs = applyAction(gs, "FOLD"); gs = applyAction(gs, "FOLD");

    // Now it's SB's turn; SB folds → BB wins
    const { status } = playAction(gs, "FOLD");
    expect(status.phase).toBe("HAND_OVER");
    expect(status.winner).toBe("BB");
  });
});

// ---------------------------------------------------------------------------
// Full walkthrough — simulates a complete hand across all four streets
// ---------------------------------------------------------------------------

describe("Full-hand walkthrough: HU preflop limp → check-down to river", () => {
  it("plays SRP checked to showdown across all 4 streets", () => {
    let gs = createInitialGameState(makeHUSpot());

    // Preflop: SB completes, BB checks option
    gs = playAction(gs, "CALL").state;
    gs = playAction(gs, "CHECK").state;
    expect(handStatus(gs).phase).toBe("STREET_COMPLETE");

    // Flop
    gs = advanceStreet(gs, ["Ah", "Kd", "7c"]).state;
    gs = playAction(gs, "CHECK").state;
    gs = playAction(gs, "CHECK").state;

    // Turn
    gs = advanceStreet(gs, ["2s"]).state;
    gs = playAction(gs, "CHECK").state;
    gs = playAction(gs, "CHECK").state;

    // River
    gs = advanceStreet(gs, ["9h"]).state;
    gs = playAction(gs, "CHECK").state;
    const finalStatus = playAction(gs, "CHECK").status;

    expect(finalStatus.phase).toBe("HAND_OVER");
    expect(finalStatus.activePlayers).toEqual(["SB", "BB"]);
    expect(finalStatus.winner).toBeNull(); // showdown
    expect(finalStatus.finalPot).toBe(2); // 1 SB + 1 BB, no further bets
  });
});
