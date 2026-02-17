// src/lib/range/index.ts

export type {
  RangeActionType,
  ActionFrequency,
  HandAction,
  RangeData,
  EquityCategory,
} from "./types";
export { RangeActionTypes, EquityCategories } from "./types";

export {
  normalizeHandString,
  categorizeHandStrength,
  normalizeActionFrequencies,
} from "./rangeHelpers";

export { ACTION_COLORS, getActionColor } from "./colorScheme";

export type { Rank } from "./gridLayout";
export { RANKS, RANK_INDEX, getGridPosition, getHandAtPosition } from "./gridLayout";

export type { RangeContextValue } from "./context";
export { RangeContext } from "./context";
