import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillSuggestion } from "./drillSuggestions";

// Mock Prisma client before importing the module under test
vi.mock("../../prisma/client", () => ({
  default: {
    spotStat: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "../../prisma/client";
import { computeDrillSuggestions } from "./drillSuggestions";

const mockFindMany = vi.mocked(prisma.spotStat.findMany);

describe("computeDrillSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns top suggestions sorted by worst avgEvLoss", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "1",
        userId: "user-1",
        heroPosition: "BB",
        villainPosition: "CO",
        totalDecisions: 20,
        correctDecisions: 10,
        avgEvLoss: 1.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        userId: "user-1",
        heroPosition: "BTN",
        villainPosition: "SB",
        totalDecisions: 15,
        correctDecisions: 12,
        avgEvLoss: 0.8,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const suggestions = await computeDrillSuggestions("user-1");

    expect(suggestions).toHaveLength(2);

    // First suggestion should be the worst performer
    expect(suggestions[0].spotLabel).toBe("BB vs CO");
    expect(suggestions[0].accuracy).toBe(50); // 10/20 * 100
    expect(suggestions[0].avgEvLoss).toBe(1.5);
    expect(suggestions[0].positions).toEqual(["BB"]);
    expect(suggestions[0].potTypes).toEqual([]);

    // Second suggestion
    expect(suggestions[1].spotLabel).toBe("BTN vs SB");
    expect(suggestions[1].accuracy).toBe(80); // 12/15 * 100
    expect(suggestions[1].avgEvLoss).toBe(0.8);
  });

  it("returns empty array when no stats meet threshold", async () => {
    mockFindMany.mockResolvedValue([]);

    const suggestions = await computeDrillSuggestions("user-no-stats");
    expect(suggestions).toEqual([]);
  });

  it("handles spots without villain position", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "3",
        userId: "user-1",
        heroPosition: "UTG",
        villainPosition: null,
        totalDecisions: 12,
        correctDecisions: 6,
        avgEvLoss: 2.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);

    const suggestions = await computeDrillSuggestions("user-1");

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].spotLabel).toBe("UTG");
    expect(suggestions[0].accuracy).toBe(50);
  });

  it("calls Prisma with correct filters", async () => {
    mockFindMany.mockResolvedValue([]);

    await computeDrillSuggestions("test-user-id");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        userId: "test-user-id",
        totalDecisions: { gte: 10 },
      },
      orderBy: { avgEvLoss: "desc" },
      take: 3,
    });
  });
});
