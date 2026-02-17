import { describe, it, expect } from "vitest";
import { classifyPreflopScenario, type PreflopScenarioType } from "./scenarioClassifier";
import type { Spot } from "../../engine/spot";

function createPreflopSpot(heroToAct: string, historyLength: number): Spot {
  return {
    schemaVersion: "1",
    spotId: "test-spot",
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1 },
    positions: ["BTN", "SB", "BB"],
    stacksBb: { BTN: 100, SB: 100, BB: 100 },
    potBb: 1.5,
    board: [],
    history: Array(historyLength).fill("ACTION"),
    heroToAct: heroToAct,
  } as unknown as Spot;
}

function createPostflopSpot(): Spot {
  return {
    schemaVersion: "1",
    spotId: "test-spot",
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1 },
    positions: ["BTN", "SB"],
    stacksBb: { BTN: 100, SB: 100 },
    potBb: 10,
    board: ["Ah", "Kd", "Qc"],
    history: ["ACTION"],
    heroToAct: "BTN",
  } as unknown as Spot;
}

describe("classifyPreflopScenario", () => {
  describe("RFI scenarios", () => {
    it("returns RFI when history is empty (first to act)", () => {
      const spot = createPreflopSpot("BTN", 0);
      expect(classifyPreflopScenario(spot)).toBe("RFI");
    });

    it("returns RFI from various positions", () => {
      const positions = ["UTG", "MP", "CO", "BTN"];
      for (const pos of positions) {
        const spot = createPreflopSpot(pos, 0);
        expect(classifyPreflopScenario(spot)).toBe("RFI");
      }
    });
  });

  describe("FacingOpen scenarios", () => {
    it("returns FacingOpen when history has 1 action", () => {
      const spot = createPreflopSpot("BTN", 1);
      expect(classifyPreflopScenario(spot)).toBe("FacingOpen");
    });

    it("returns FacingOpen from non-blind positions", () => {
      const positions = ["MP", "CO", "BTN"];
      for (const pos of positions) {
        const spot = createPreflopSpot(pos, 1);
        expect(classifyPreflopScenario(spot)).toBe("FacingOpen");
      }
    });
  });

  describe("3Bet scenarios", () => {
    it("returns 3Bet when history has 2 actions", () => {
      const spot = createPreflopSpot("BTN", 2);
      expect(classifyPreflopScenario(spot)).toBe("3Bet");
    });

    it("returns 3Bet from non-blind positions", () => {
      const positions = ["MP", "CO", "BTN"];
      for (const pos of positions) {
        const spot = createPreflopSpot(pos, 2);
        expect(classifyPreflopScenario(spot)).toBe("3Bet");
      }
    });
  });

  describe("BlindDefense scenarios", () => {
    it("returns BlindDefense for BB facing open", () => {
      const spot = createPreflopSpot("BB", 1);
      expect(classifyPreflopScenario(spot)).toBe("BlindDefense");
    });

    it("returns BlindDefense for SB facing open", () => {
      const spot = createPreflopSpot("SB", 1);
      expect(classifyPreflopScenario(spot)).toBe("BlindDefense");
    });

    it("returns BlindDefense for BB facing 3bet (priority over 3Bet)", () => {
      const spot = createPreflopSpot("BB", 2);
      expect(classifyPreflopScenario(spot)).toBe("BlindDefense");
    });

    it("returns BlindDefense for SB facing 3bet (priority over 3Bet)", () => {
      const spot = createPreflopSpot("SB", 2);
      expect(classifyPreflopScenario(spot)).toBe("BlindDefense");
    });

    it("returns BlindDefense for BB with multiple actions", () => {
      const spot = createPreflopSpot("BB", 3);
      expect(classifyPreflopScenario(spot)).toBe("BlindDefense");
    });
  });

  describe("non-preflop spots", () => {
    it("returns null for flop spot", () => {
      const spot = createPostflopSpot();
      expect(classifyPreflopScenario(spot)).toBeNull();
    });

    it("returns null for turn spot", () => {
      const spot = createPostflopSpot();
      spot.board = ["Ah", "Kd", "Qc", "Js"];
      expect(classifyPreflopScenario(spot)).toBeNull();
    });

    it("returns null for river spot", () => {
      const spot = createPostflopSpot();
      spot.board = ["Ah", "Kd", "Qc", "Js", "Th"];
      expect(classifyPreflopScenario(spot)).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for 4bet+ scenarios (history.length > 2, non-blind)", () => {
      const spot = createPreflopSpot("BTN", 3);
      expect(classifyPreflopScenario(spot)).toBeNull();
    });

    it("prioritizes BlindDefense over RFI when SB is first to act", () => {
      // SB with empty history could be considered RFI, but not facing action
      // so should be RFI (no action to defend against)
      const spot = createPreflopSpot("SB", 0);
      expect(classifyPreflopScenario(spot)).toBe("RFI");
    });

    it("prioritizes BlindDefense over RFI when BB is first to act", () => {
      // BB with empty history should be RFI (no action to defend)
      const spot = createPreflopSpot("BB", 0);
      expect(classifyPreflopScenario(spot)).toBe("RFI");
    });
  });
});
