import { describe, expect, it } from "vitest";
import { computeSpotId, SpotSchemaVersion, validateSpot, type Spot } from "./spot";

function buildSpot(overrides: Partial<Spot> = {}): Spot {
  const base: Omit<Spot, "spotId"> = {
    schemaVersion: SpotSchemaVersion,
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1, ante: 0 },
    positions: ["SB", "BB", "BTN"],
    stacksBb: { SB: 50, BB: 50, BTN: 50 },
    potBb: 1.5,
    board: ["Ah", "Kd", "7c"],
    history: ["CHECK"],
    heroToAct: "BTN",
  };
  const spotId = computeSpotId(base);
  return { ...base, spotId, ...overrides };
}

describe("spot", () => {
  it("validates a well-formed spot", () => {
    const spot = buildSpot();
    expect(validateSpot(spot, { verifySpotId: true })).toEqual(spot);
  });

  it("rejects duplicate board cards", () => {
    const spot = buildSpot({ board: ["Ah", "Ah"] });
    expect(() => validateSpot(spot)).toThrow();
  });

  it("rejects invalid board length", () => {
    const spot = buildSpot({ board: ["Ah", "Kd", "7c", "2s", "3d", "4h"] });
    expect(() => validateSpot(spot)).toThrow();
  });

  it("rejects negative stacks or pot", () => {
    const badStacks = buildSpot({
      stacksBb: { SB: 50, BB: -1, BTN: 50 },
    });
    expect(() => validateSpot(badStacks)).toThrow();

    const badPot = buildSpot({ potBb: -0.5 });
    expect(() => validateSpot(badPot)).toThrow();
  });

  it("requires heroToAct within positions", () => {
    const spot = buildSpot({ heroToAct: "UTG" as Spot["heroToAct"] });
    expect(() => validateSpot(spot)).toThrow();
  });
});
