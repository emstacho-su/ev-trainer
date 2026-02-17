import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpotPack, type SpotPack } from "./spotPack";
import { SpotSchemaVersion, type Spot } from "../../engine/spot";

function loadPackJson(): unknown {
  const packPath = resolve(process.cwd(), "public/packs/ev-dev-pack-v1.json");
  const raw = readFileSync(packPath, "utf-8");
  return JSON.parse(raw) as unknown;
}

describe("SpotPack loader", () => {
  it("loads a valid pack", () => {
    const pack = parseSpotPack(loadPackJson());
    expect(pack.packId).toBe("ev-dev-pack-v1");
    expect(pack.spots.length).toBeGreaterThan(0);
  });

  it("rejects invalid pack data with clear errors", () => {
    const invalid = loadPackJson() as Record<string, unknown>;
    invalid.packId = "";
    expect(() => parseSpotPack(invalid)).toThrow(/packId/i);
  });

  it("enriches preflop spots with scenario type", () => {
    const preflopPack: unknown = {
      schemaVersion: "1",
      packId: "test-preflop",
      name: "Test Preflop Pack",
      version: "1.0.0",
      createdAt: "2024-01-01T00:00:00Z",
      spots: [
        {
          spot: {
            schemaVersion: SpotSchemaVersion,
            spotId: "rfi-test",
            gameType: "NLHE",
            blinds: { sb: 0.5, bb: 1 },
            positions: ["BTN", "SB", "BB"],
            stacksBb: { BTN: 100, SB: 100, BB: 100 },
            potBb: 1.5,
            board: [],
            history: [],
            heroToAct: "BTN",
          } as unknown as Spot,
          meta: {
            street: "PREFLOP",
            heroPosition: "BTN",
            villainPosition: "SB",
            effectiveStackBb: 100,
            potType: "SRP",
          },
        },
        {
          spot: {
            schemaVersion: SpotSchemaVersion,
            spotId: "facing-open-test",
            gameType: "NLHE",
            blinds: { sb: 0.5, bb: 1 },
            positions: ["UTG", "BTN", "SB"],
            stacksBb: { UTG: 100, BTN: 100, SB: 100 },
            potBb: 3.5,
            board: [],
            history: ["RAISE"],
            heroToAct: "BTN",
          } as unknown as Spot,
          meta: {
            street: "PREFLOP",
            heroPosition: "BTN",
            villainPosition: "UTG",
            effectiveStackBb: 100,
            potType: "SRP",
          },
        },
      ],
    };

    const pack = parseSpotPack(preflopPack);
    expect(pack.spots[0].meta.scenarioType).toBe("RFI");
    expect(pack.spots[1].meta.scenarioType).toBe("FacingOpen");
  });

  it("does not add scenario type to postflop spots", () => {
    const postflopPack: unknown = {
      schemaVersion: "1",
      packId: "test-postflop",
      name: "Test Postflop Pack",
      version: "1.0.0",
      createdAt: "2024-01-01T00:00:00Z",
      spots: [
        {
          spot: {
            schemaVersion: SpotSchemaVersion,
            spotId: "flop-test",
            gameType: "NLHE",
            blinds: { sb: 0.5, bb: 1 },
            positions: ["BTN", "BB"],
            stacksBb: { BTN: 100, BB: 100 },
            potBb: 5,
            board: ["Ah", "Kd", "Qc"],
            history: ["CHECK"],
            heroToAct: "BTN",
          } as unknown as Spot,
          meta: {
            street: "FLOP",
            heroPosition: "BTN",
            villainPosition: "BB",
            effectiveStackBb: 100,
            potType: "SRP",
          },
        },
      ],
    };

    const pack = parseSpotPack(postflopPack);
    expect(pack.spots[0].meta.scenarioType).toBeUndefined();
  });
});
