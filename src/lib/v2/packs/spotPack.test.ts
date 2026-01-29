import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpotPack } from "./spotPack";

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
});
