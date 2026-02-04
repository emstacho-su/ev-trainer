import { describe, expect, it } from "vitest";
import {
  computeScenarioRegenerationKey,
  shouldIncludeDecisionForDealOnly,
  validateTrainerScenario,
  validateTrainerScenarioConfig,
} from "./scenarioContract";

describe("scenarioContract", () => {
  const config = validateTrainerScenarioConfig({
    schemaVersion: "scenario.v1",
    mode: "postflop",
    gameType: "cash",
    tableSize: "6-max",
    stackDepthBb: 100,
    villainBehavior: "gto",
    dealOnlyDecisions: true,
  });

  it("validates a preflop scenario fixture", () => {
    const scenario = validateTrainerScenario({
      scenarioType: "preflop",
      scenarioId: "pf-001",
      lineFamily: "vs-open",
      heroPosition: "BTN",
      villainPosition: "BB",
      actionHistory: ["RAISE_2.5BB"],
    });
    expect(scenario.scenarioType).toBe("preflop");
  });

  it("validates and normalizes a postflop scenario fixture", () => {
    const scenario = validateTrainerScenario({
      scenarioType: "postflop",
      scenarioId: "flop-001",
      pool: {
        poolId: "pool-a",
        poolVersion: "1",
        entryStreet: "FLOP",
        board: ["2c", "Ah", "7d"],
        boardTextureBucket: "rainbow-low",
      },
      preflopContext: {
        lineFamily: "vs-open",
        heroPosition: "BTN",
        villainPosition: "BB",
        actionHistory: ["RAISE_2.5BB", "CALL"],
      },
    });
    expect(scenario.scenarioType).toBe("postflop");
    if (scenario.scenarioType === "postflop") {
      expect(scenario.pool.board).toEqual(["2c", "7d", "Ah"]);
    }
  });

  it("produces stable regeneration key for semantically equivalent payloads", () => {
    const a = validateTrainerScenario({
      scenarioType: "postflop",
      scenarioId: "flop-002",
      pool: {
        poolId: "pool-b",
        poolVersion: "1",
        entryStreet: "FLOP",
        board: ["Ah", "7d", "2c"],
      },
      preflopContext: {
        lineFamily: "open-raise",
        heroPosition: "BTN",
        villainPosition: "BB",
        actionHistory: ["RAISE_2.0BB", "CALL"],
      },
    });
    const b = validateTrainerScenario({
      scenarioType: "postflop",
      scenarioId: "flop-002",
      pool: {
        poolId: "pool-b",
        poolVersion: "1",
        entryStreet: "FLOP",
        board: ["2c", "Ah", "7d"],
      },
      preflopContext: {
        lineFamily: "open-raise",
        heroPosition: "BTN",
        villainPosition: "BB",
        actionHistory: ["RAISE_2.0BB", "CALL"],
      },
    });

    expect(computeScenarioRegenerationKey(config, a)).toBe(computeScenarioRegenerationKey(config, b));
  });

  it("implements dealOnlyDecisions filtering contract", () => {
    expect(
      shouldIncludeDecisionForDealOnly(config, {
        legalActionCount: 1,
        hasForcedAction: true,
        allActionsEquivalent: true,
      })
    ).toBe(false);
    expect(
      shouldIncludeDecisionForDealOnly(config, {
        legalActionCount: 3,
        hasForcedAction: false,
        allActionsEquivalent: false,
      })
    ).toBe(true);
  });

  it("rejects invalid scenario payloads", () => {
    expect(() =>
      validateTrainerScenario({
        scenarioType: "postflop",
        scenarioId: "bad-1",
        preflopContext: {
          lineFamily: "vs-open",
          heroPosition: "BTN",
          villainPosition: "BB",
          actionHistory: [],
        },
      })
    ).toThrow();
  });
});
