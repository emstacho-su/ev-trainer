// src/lib/engine/availableActions.test.ts

import { describe, it, expect } from "vitest";
import { getAvailableActions } from "./availableActions";
import type { Spot } from "./spot";
import type { Position } from "./types";

function make6MaxSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    schemaVersion: "1",
    spotId: "menu-spot",
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
    spotId: "menu-flop",
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

describe("getAvailableActions — preflop RFI (UTG facing BB)", () => {
  it("returns FOLD, CALL, raise sizes, and ALL_IN", () => {
    const actions = getAvailableActions(make6MaxSpot());
    const ids = actions.map((a) => a.actionId);

    expect(ids).toContain("FOLD");
    expect(ids).toContain("CALL");
    expect(ids).toContain("ALL_IN");
    expect(ids.some((id) => id.startsWith("RAISE_"))).toBe(true);
  });

  it("does not include CHECK when facing a bet", () => {
    const actions = getAvailableActions(make6MaxSpot());
    expect(actions.map((a) => a.actionId)).not.toContain("CHECK");
  });
});

describe("getAvailableActions — flop no bet", () => {
  it("returns CHECK and bet sizes, not FOLD", () => {
    const actions = getAvailableActions(makeFlopSpot());
    const ids = actions.map((a) => a.actionId);

    expect(ids).toContain("CHECK");
    expect(ids).toContain("ALL_IN");
    expect(ids.some((id) => id.startsWith("BET_"))).toBe(true);
    expect(ids).not.toContain("FOLD");
    expect(ids).not.toContain("CALL");
  });

  it("pot of 10bb produces bet sizes up to 100% pot", () => {
    const actions = getAvailableActions(makeFlopSpot());
    const ids = actions.map((a) => a.actionId);

    // 33%, 50%, 75%, 100% of 10bb = 3.3, 5, 7.5, 10 — all <= 95bb stack, all >= 1bb min
    expect(ids).toContain("BET_33PCT");
    expect(ids).toContain("BET_50PCT");
    expect(ids).toContain("BET_75PCT");
    expect(ids).toContain("BET_100PCT");
  });
});

describe("getAvailableActions — stack-depth filtering", () => {
  it("omits raise sizes that exceed short-stack maximum", () => {
    // UTG has 2bb — can't raise to 3x (=3bb) because max raise is 2bb
    const actions = getAvailableActions(
      make6MaxSpot({
        stacksBb: {
          SB: 100, BB: 100, UTG: 2, HJ: 100, CO: 100, BTN: 100,
        } as Record<Position, number>,
      }),
    );
    const ids = actions.map((a) => a.actionId);

    // 2.2x, 2.5x, 3x = 2.2, 2.5, 3.0 bb total — all exceed UTG's max raise of 2
    expect(ids).not.toContain("RAISE_2.2X");
    expect(ids).not.toContain("RAISE_2.5X");
    expect(ids).not.toContain("RAISE_3.0X");
    // But ALL_IN should still be present
    expect(ids).toContain("ALL_IN");
  });

  it("omits bet sizes smaller than minBet on tiny pots", () => {
    // Pot of 2bb (just blinds) — 33% = 0.66bb, below 1bb min
    const actions = getAvailableActions(
      makeFlopSpot({
        potBb: 2,
      }),
    );
    const ids = actions.map((a) => a.actionId);

    // 33% of 2bb = 0.66bb < 1bb min bet
    expect(ids).not.toContain("BET_33PCT");
    // 50% of 2bb = 1bb -- at minimum, legal
    expect(ids).toContain("BET_50PCT");
    // 100% of 2bb = 2bb -- legal
    expect(ids).toContain("BET_100PCT");
  });

  it("includes fallback RAISE_MIN when no standard raise fits", () => {
    // Stack 1.5bb facing 1bb bet: min-raise=2bb > max-raise=1.5bb, but raise rights still allow
    // all-in... actually canRaise is false when max < min. So no raise fallback.
    // Test the fallback when stack allows min-raise but not the 2.2x bucket:
    // UTG stack 2.2 facing 1bb bet → min-raise=2 (via 1+1), max-raise=2.2 → 2.2x (=2.2) fits
    // Use UTG=2.05 instead: min-raise=2, max-raise=2.05 → 2.2x/2.5x/3x (all >= 2.2) don't fit
    const actions = getAvailableActions(
      make6MaxSpot({
        stacksBb: {
          SB: 100, BB: 100, UTG: 2.05, HJ: 100, CO: 100, BTN: 100,
        } as Record<Position, number>,
      }),
    );
    const ids = actions.map((a) => a.actionId);

    // No 2.2x/2.5x/3x possible, but min-raise of 2 is possible
    expect(ids.some((id) => id.startsWith("RAISE_"))).toBe(true);
    expect(ids).toContain("ALL_IN");
  });
});

describe("getAvailableActions — heads-up preflop SB", () => {
  it("SB (first to act heads-up) has FOLD + CALL + raise options", () => {
    const actions = getAvailableActions(
      make6MaxSpot({
        positions: ["SB", "BB"] as Position[],
        stacksBb: { SB: 100, BB: 100 } as Record<Position, number>,
        heroToAct: "SB" as Position,
      }),
    );
    const ids = actions.map((a) => a.actionId);

    expect(ids).toContain("FOLD");
    expect(ids).toContain("CALL");
    expect(ids.some((id) => id.startsWith("RAISE_"))).toBe(true);
  });
});
