/**
 * Overview: Spot filter model, stack bucketing, and AND-style filter matching.
 * Interacts with: spot pack metadata and setup/session filtering inputs.
 * Importance: Determines candidate pool quality before deterministic selection.
 */

import type { Position, Street } from "../../engine/types";
import type { PotType, SpotEntry } from "../packs/spotPack";
import type { PreflopScenarioType } from "../packs/scenarioClassifier";

export const EffectiveStackBuckets = ["20", "40", "60", "100", "150+"] as const;
export type EffectiveStackBucket = (typeof EffectiveStackBuckets)[number];

export type PotTypeFilter = PotType | "ANY";
export type ScenarioTypeFilter = PreflopScenarioType | "ANY";

export interface SpotFilterInput {
  street?: Street;
  heroPosition?: Position;
  heroPositions?: Position[];
  villainPosition?: Position;
  effectiveStackBbBucket?: EffectiveStackBucket;
  potType?: PotTypeFilter;
  potTypes?: PotTypeFilter[];
  scenarioType?: ScenarioTypeFilter;
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
  if (filters.heroPositions && filters.heroPositions.length > 0) {
    if (!filters.heroPositions.includes(entry.meta.heroPosition)) return false;
  }
  if (filters.villainPosition && entry.meta.villainPosition !== filters.villainPosition)
    return false;
  if (filters.potType && filters.potType !== "ANY" && entry.meta.potType !== filters.potType)
    return false;
  if (filters.potTypes && filters.potTypes.length > 0) {
    if (!filters.potTypes.some(pt => pt === "ANY" || pt === entry.meta.potType)) return false;
  }
  if (filters.effectiveStackBbBucket) {
    const bucket = bucketEffectiveStackBb(entry.meta.effectiveStackBb);
    if (bucket !== filters.effectiveStackBbBucket) return false;
  }
  if (filters.scenarioType && filters.scenarioType !== "ANY") {
    if (!entry.meta.scenarioType || entry.meta.scenarioType !== filters.scenarioType) {
      return false;
    }
  }
  return true;
}

export function filterSpotEntries(
  entries: SpotEntry[],
  filters: SpotFilterInput
): SpotEntry[] {
  return entries.filter((entry) => matchesSpotFilters(entry, filters));
}
