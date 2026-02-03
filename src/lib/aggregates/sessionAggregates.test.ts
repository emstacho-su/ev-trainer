import { describe, expect, it } from "vitest";
import { computeSessionAggregates } from "./sessionAggregates";

describe("computeSessionAggregates", () => {
  it("computes mean EV loss and best-action rate", () => {
    const aggregates = computeSessionAggregates([
      { result: { evLossVsBest: 0 } },
      { result: { evLossVsBest: 0.5 } },
      { result: { evLossVsBest: 1 } },
    ]);

    expect(aggregates.volume).toBe(3);
    expect(aggregates.meanEvLoss).toBeCloseTo(0.5, 8);
    expect(aggregates.bestActionRate).toBeCloseTo(1 / 3, 8);
  });

  it("prefers grade.evLossVsBest over result.evLossVsBest", () => {
    const aggregates = computeSessionAggregates([
      { grade: { evLossVsBest: 0.25 }, result: { evLossVsBest: 1 } },
    ]);

    expect(aggregates.volume).toBe(1);
    expect(aggregates.meanEvLoss).toBeCloseTo(0.25, 8);
    expect(aggregates.bestActionRate).toBe(0);
  });

  it("returns zeros for empty entries", () => {
    const aggregates = computeSessionAggregates([]);
    expect(aggregates).toEqual({ volume: 0, meanEvLoss: 0, bestActionRate: 0 });
  });
});
