// src/lib/range/types.ts

/**
 * Action types for range visualization.
 * These are solver-output actions (lowercase), distinct from engine ActionType (uppercase).
 */
export const RangeActionTypes = ["fold", "call", "raise", "jam"] as const;
export type RangeActionType = (typeof RangeActionTypes)[number];

/**
 * A single action with its frequency (0.0 to 1.0).
 */
export interface ActionFrequency {
  type: RangeActionType;
  frequency: number;
}

/**
 * A hand with its solver-recommended action distribution.
 * Example: { hand: "AKs", actions: [{ type: "raise", frequency: 0.85 }, { type: "call", frequency: 0.15 }] }
 */
export interface HandAction {
  hand: string;
  actions: ActionFrequency[];
}

/**
 * Complete range data from solver output.
 */
export interface RangeData {
  hands: HandAction[];
  totalCombos: number;
}

/**
 * Categories for grouping hands by equity/structure.
 */
export const EquityCategories = [
  "premium-pairs",
  "medium-pairs",
  "small-pairs",
  "broadway",
  "suited-connectors",
  "suited-gappers",
  "offsuit",
] as const;
export type EquityCategory = (typeof EquityCategories)[number];
