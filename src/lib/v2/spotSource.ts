import { combineSeed, createSeededRng } from "../engine/rng";
import type { SpotPack, SpotEntry } from "./packs/spotPack";
import type { SpotFilterInput } from "./filters/spotFilters";
import { filterSpotEntries } from "./filters/spotFilters";

export function getFilteredSpots(pack: SpotPack, filters: SpotFilterInput): SpotEntry[] {
  return filterSpotEntries(pack.spots, filters);
}

export function selectDeterministicSpot(
  candidates: SpotEntry[],
  seed: string,
  sessionId: string,
  decisionIndex: number
): SpotEntry | null {
  if (candidates.length === 0) return null;
  if (typeof seed !== "string" || seed.length === 0) {
    throw new Error("seed must be a non-empty string");
  }
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error("sessionId must be a non-empty string");
  }
  if (!Number.isInteger(decisionIndex) || decisionIndex < 0) {
    throw new Error("decisionIndex must be a non-negative integer");
  }

  const sorted = [...candidates].sort((a, b) =>
    a.spot.spotId.localeCompare(b.spot.spotId)
  );
  const combinedSeed = combineSeed([seed, sessionId, decisionIndex]);
  const rng = createSeededRng(combinedSeed);
  const index = Math.min(sorted.length - 1, Math.floor(rng.next() * sorted.length));
  return sorted[index];
}

export function selectSpotFromPack(
  pack: SpotPack,
  filters: SpotFilterInput,
  seed: string,
  sessionId: string,
  decisionIndex: number
): SpotEntry | null {
  const candidates = getFilteredSpots(pack, filters);
  return selectDeterministicSpot(candidates, seed, sessionId, decisionIndex);
}
