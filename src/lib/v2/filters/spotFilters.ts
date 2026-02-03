import type { Position, Street } from "../../engine/types";
import type { PotType, SpotEntry } from "../packs/spotPack";

export const EffectiveStackBuckets = ["20", "40", "60", "100", "150+"] as const;
export type EffectiveStackBucket = (typeof EffectiveStackBuckets)[number];

export type PotTypeFilter = PotType | "ANY";

export interface SpotFilterInput {
  street?: Street;
  heroPosition?: Position;
  villainPosition?: Position;
  effectiveStackBbBucket?: EffectiveStackBucket;
  potType?: PotTypeFilter;
}

export function bucketEffectiveStackBb(value: number): EffectiveStackBucket {
  if (value <= 20) return "20";
  if (value <= 40) return "40";
  if (value <= 60) return "60";
  if (value <= 100) return "100";
  return "150+";
}

export function matchesSpotFilters(entry: SpotEntry, filters: SpotFilterInput): boolean {
  if (filters.street && entry.meta.street !== filters.street) return false;
  if (filters.heroPosition && entry.meta.heroPosition !== filters.heroPosition) return false;
  if (filters.villainPosition && entry.meta.villainPosition !== filters.villainPosition)
    return false;
  if (filters.potType && filters.potType !== "ANY" && entry.meta.potType !== filters.potType)
    return false;
  if (filters.effectiveStackBbBucket) {
    const bucket = bucketEffectiveStackBb(entry.meta.effectiveStackBb);
    if (bucket !== filters.effectiveStackBbBucket) return false;
  }
  return true;
}

export function filterSpotEntries(
  entries: SpotEntry[],
  filters: SpotFilterInput
): SpotEntry[] {
  return entries.filter((entry) => matchesSpotFilters(entry, filters));
}
