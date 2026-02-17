// src/lib/range/colorScheme.ts

import type { RangeActionType } from "./types";

/**
 * Maps action types to CSS custom property names.
 * These reference tokens defined in globals.css @layer base.
 */
export const ACTION_COLORS: Record<RangeActionType, string> = {
  fold: "var(--color-action-fold)",
  call: "var(--color-action-call)",
  raise: "var(--color-action-raise)",
  jam: "var(--color-action-jam)",
} as const;

/**
 * Returns the CSS variable reference for a given action type.
 */
export function getActionColor(action: RangeActionType): string {
  return ACTION_COLORS[action];
}
