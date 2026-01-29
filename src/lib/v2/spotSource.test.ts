import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { combineSeed, createSeededRng } from "../engine/rng";
import { parseSpotPack } from "./packs/spotPack";
import { getFilteredSpots, selectDeterministicSpot, selectSpotFromPack } from "./spotSource";

function loadPack() {
  const packPath = resolve(process.cwd(), "public/packs/ev-dev-pack-v1.json");
  const raw = readFileSync(packPath, "utf-8");
  return parseSpotPack(JSON.parse(raw) as unknown);
}

function expectedIndex(seed: string, sessionId: string, decisionIndex: number, count: number) {
  const combined = combineSeed([seed, sessionId, decisionIndex]);
  const rng = createSeededRng(combined);
  return Math.min(count - 1, Math.floor(rng.next() * count));
}

describe("v2 spot selection", () => {
  it("selects deterministically for the same inputs", () => {
    const pack = loadPack();
    const filters = {};
    const sequenceA = Array.from({ length: 4 }).map((_, i) =>
      selectSpotFromPack(pack, filters, "seed-a", "session-1", i)?.spot.spotId
    );
    const sequenceB = Array.from({ length: 4 }).map((_, i) =>
      selectSpotFromPack(pack, filters, "seed-a", "session-1", i)?.spot.spotId
    );
    expect(sequenceA).toEqual(sequenceB);
  });

  it("changes selection when seed/sessionId change (expected indices differ)", () => {
    const pack = loadPack();
    const candidates = getFilteredSpots(pack, {});
    const sorted = [...candidates].sort((a, b) => a.spot.spotId.localeCompare(b.spot.spotId));

    const seeds = ["seed-a", "seed-b", "seed-c", "seed-d"];
    let seedPair: [string, string] | null = null;
    for (let i = 0; i < seeds.length && !seedPair; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        const indexA = expectedIndex(seeds[i], "session-1", 0, sorted.length);
        const indexB = expectedIndex(seeds[j], "session-1", 0, sorted.length);
        if (indexA !== indexB) {
          seedPair = [seeds[i], seeds[j]];
          break;
        }
      }
    }
    if (!seedPair) {
      throw new Error("no seed pair produced different selection");
    }
    const indexSeedA = expectedIndex(seedPair[0], "session-1", 0, sorted.length);
    const indexSeedB = expectedIndex(seedPair[1], "session-1", 0, sorted.length);
    expect(indexSeedA).not.toBe(indexSeedB);

    const sessionIds = ["session-1", "session-2", "session-3", "session-4"];
    let sessionPair: [string, string] | null = null;
    for (let i = 0; i < sessionIds.length && !sessionPair; i++) {
      for (let j = i + 1; j < sessionIds.length; j++) {
        const indexA = expectedIndex("seed-a", sessionIds[i], 0, sorted.length);
        const indexB = expectedIndex("seed-a", sessionIds[j], 0, sorted.length);
        if (indexA !== indexB) {
          sessionPair = [sessionIds[i], sessionIds[j]];
          break;
        }
      }
    }
    if (!sessionPair) {
      throw new Error("no sessionId pair produced different selection");
    }
    const indexSessionA = expectedIndex("seed-a", sessionPair[0], 0, sorted.length);
    const indexSessionB = expectedIndex("seed-a", sessionPair[1], 0, sorted.length);
    expect(indexSessionA).not.toBe(indexSessionB);

    const selectedSeedA = selectDeterministicSpot(candidates, seedPair[0], "session-1", 0);
    const selectedSeedB = selectDeterministicSpot(candidates, seedPair[1], "session-1", 0);
    expect(selectedSeedA?.spot.spotId).toBe(sorted[indexSeedA].spot.spotId);
    expect(selectedSeedB?.spot.spotId).toBe(sorted[indexSeedB].spot.spotId);
  });

  it("uses stable sorting by spotId regardless of input order", () => {
    const pack = loadPack();
    const candidates = getFilteredSpots(pack, {});
    const reversed = [...candidates].reverse();
    const selectedA = selectDeterministicSpot(candidates, "seed-c", "session-1", 0);
    const selectedB = selectDeterministicSpot(reversed, "seed-c", "session-1", 0);
    expect(selectedA?.spot.spotId).toBe(selectedB?.spot.spotId);
  });
});
