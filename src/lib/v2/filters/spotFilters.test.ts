import { describe, expect, it } from "vitest";
import { SpotSchemaVersion, type Spot } from "../../engine/spot";
import type { SpotEntry } from "../packs/spotPack";
import {
  bucketEffectiveStackBb,
  filterSpotEntries,
  matchesSpotFilters,
} from "./spotFilters";

function buildSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    schemaVersion: SpotSchemaVersion,
    spotId: "spot-test",
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1, ante: 0 },
    positions: ["BTN", "BB"],
    stacksBb: { SB: 0, BB: 100, UTG: 0, HJ: 0, CO: 0, BTN: 100 },
    potBb: 3,
    board: ["Ah", "Kd", "7c"],
    history: ["CHECK"],
    heroToAct: "BTN",
    ...overrides,
  };
}

function buildEntry(overrides: Partial<SpotEntry> = {}): SpotEntry {
  return {
    spot: buildSpot(),
    meta: {
      street: "FLOP",
      heroPosition: "BTN",
      villainPosition: "BB",
      effectiveStackBb: 100,
      potType: "SRP",
    },
    ...overrides,
  };
}

describe("spot filters", () => {
  it("matches street filter", () => {
    const entry = buildEntry();
    expect(matchesSpotFilters(entry, { street: "FLOP" })).toBe(true);
    expect(matchesSpotFilters(entry, { street: "TURN" })).toBe(false);
  });

  it("matches hero/villain positions", () => {
    const entry = buildEntry();
    expect(matchesSpotFilters(entry, { heroPosition: "BTN" })).toBe(true);
    expect(matchesSpotFilters(entry, { heroPosition: "SB" })).toBe(false);
    expect(matchesSpotFilters(entry, { villainPosition: "BB" })).toBe(true);
    expect(matchesSpotFilters(entry, { villainPosition: "UTG" })).toBe(false);
  });

  it("matches effective stack buckets", () => {
    const entry = buildEntry();
    expect(bucketEffectiveStackBb(100)).toBe("100");
    expect(matchesSpotFilters(entry, { effectiveStackBbBucket: "100" })).toBe(true);
    expect(matchesSpotFilters(entry, { effectiveStackBbBucket: "60" })).toBe(false);
  });

  it("matches pot type with ANY support", () => {
    const entry = buildEntry();
    expect(matchesSpotFilters(entry, { potType: "SRP" })).toBe(true);
    expect(matchesSpotFilters(entry, { potType: "3BP" })).toBe(false);
    expect(matchesSpotFilters(entry, { potType: "ANY" })).toBe(true);
  });

  it("filters entries with AND logic", () => {
    const entry = buildEntry();
    const other = buildEntry({
      meta: {
        street: "TURN",
        heroPosition: "BTN",
        villainPosition: "BB",
        effectiveStackBb: 60,
        potType: "3BP",
      },
    });
    const filtered = filterSpotEntries([entry, other], {
      street: "FLOP",
      potType: "SRP",
    });
    expect(filtered).toEqual([entry]);
  });
});
