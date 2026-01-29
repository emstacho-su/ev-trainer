import type { SpotPack, SpotEntry } from "./packs/spotPack";
import type { SpotFilterInput } from "./filters/spotFilters";
import { filterSpotEntries } from "./filters/spotFilters";

export function getFilteredSpots(pack: SpotPack, filters: SpotFilterInput): SpotEntry[] {
  return filterSpotEntries(pack.spots, filters);
}
