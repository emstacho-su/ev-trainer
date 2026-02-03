import { describe, expect, it } from "vitest";
import { computeGlobalStats, createZeroGlobalStats } from "./globalStats";

function completeRecord(overrides: Record<string, unknown> = {}) {
  return {
    session: { isComplete: true, filters: { street: "FLOP", potType: "SRP", effectiveStackBbBucket: "40" } },
    completedAt: "2026-02-03T12:00:00.000Z",
    aggregates: {
      volume: 4,
      meanEvLoss: 0.5,
      bestActionRate: 0.25,
    },
    ...overrides,
  };
}

describe("computeGlobalStats", () => {
  it("returns zero totals and empty breakdowns for empty input", () => {
    expect(computeGlobalStats([])).toEqual(createZeroGlobalStats());
  });

  it("ignores sessions that are not completed", () => {
    const stats = computeGlobalStats([
      {
        session: { isComplete: false },
        aggregates: { volume: 9, meanEvLoss: 2, bestActionRate: 1 },
      },
    ]);
    expect(stats).toEqual(createZeroGlobalStats());
  });

  it("computes weighted totals and sorted breakdown rows", () => {
    const stats = computeGlobalStats([
      completeRecord(),
      completeRecord({
        session: {
          isComplete: true,
          filters: { street: "TURN", potType: "3BP", effectiveStackBbBucket: "100" },
        },
        aggregates: { volume: 6, meanEvLoss: 0.2, bestActionRate: 0.5 },
      }),
    ]);

    expect(stats.totals.totalSessions).toBe(2);
    expect(stats.totals.totalDecisions).toBe(10);
    expect(stats.totals.meanEvLoss).toBeCloseTo(0.32);
    expect(stats.totals.bestActionRate).toBeCloseTo(0.4);

    expect(stats.breakdowns.byStreet.map((row) => row.bucket)).toEqual(["TURN", "FLOP"]);
    expect(stats.breakdowns.byStreet[0]?.decisions).toBe(6);
    expect(stats.breakdowns.byStreet[1]?.decisions).toBe(4);
  });

  it("computes aggregates from entries when aggregate snapshot is missing", () => {
    const stats = computeGlobalStats([
      completeRecord({
        aggregates: undefined,
        entries: [
          {
            result: { evLossVsBest: 0 },
            spot: { street: "RIVER", potType: "3BP", effectiveStackBb: 80 },
          },
          {
            result: { evLossVsBest: 1 },
            spot: { street: "RIVER", potType: "3BP", effectiveStackBb: 170 },
          },
        ],
      }),
    ]);

    expect(stats.totals.totalSessions).toBe(1);
    expect(stats.totals.totalDecisions).toBe(2);
    expect(stats.totals.meanEvLoss).toBeCloseTo(0.5);
    expect(stats.totals.bestActionRate).toBeCloseTo(0.5);
    expect(stats.breakdowns.byStreet).toEqual([
      { bucket: "RIVER", decisions: 2, meanEvLoss: 0.5, bestActionRate: 0.5 },
    ]);
    expect(stats.breakdowns.byStackBucket.map((row) => row.bucket)).toEqual([
      "100",
      "150+",
    ]);
  });

  it("handles corrupt sessions safely and uses unknown buckets for missing fields", () => {
    const stats = computeGlobalStats([
      null,
      "bad",
      completeRecord({
        session: { isComplete: true, filters: {} },
        aggregates: { volume: 3, meanEvLoss: 0.4, bestActionRate: 1 / 3 },
      }),
      completeRecord({
        session: { isComplete: true },
        aggregates: { volume: "x", meanEvLoss: 1, bestActionRate: 0.2 },
      }),
    ]);

    expect(stats.totals.totalSessions).toBe(1);
    expect(stats.breakdowns.byStreet).toHaveLength(1);
    expect(stats.breakdowns.byStreet[0]?.bucket).toBe("unknown");
    expect(stats.breakdowns.byStreet[0]?.decisions).toBe(3);
    expect(stats.breakdowns.byStreet[0]?.meanEvLoss).toBeCloseTo(0.4);
    expect(stats.breakdowns.byStreet[0]?.bestActionRate).toBeCloseTo(1 / 3);
    expect(stats.breakdowns.byPotType[0]?.bucket).toBe("unknown");
    expect(stats.breakdowns.byStackBucket[0]?.bucket).toBe("unknown");
  });
});
