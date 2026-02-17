/**
 * Overview: Zod validation schemas for trainer configuration.
 * Interacts with: config types, localStorage persistence, API endpoints.
 * Importance: Ensures config integrity on load, save, and API boundaries.
 */

import { z } from "zod";
import type { TrainerConfig } from "./types";

/**
 * Zod schema for TrainerConfig with defaults and validation rules.
 *
 * Provides:
 * - Default values for all required fields (safe to parse empty objects)
 * - Minimum selection rules for positions and potTypes (at least 1 each)
 * - Range validation for optional handCountTarget (1-1000)
 */
export const trainerConfigSchema = z.object({
  mode: z.enum(["PREFLOP", "FLOP"]).default("PREFLOP"),
  gameType: z.enum(["CASH", "HU"]).default("CASH"),
  tableSize: z.enum(["6max", "9max"]).default("6max"),
  stackDepth: z.enum(["50bb", "100bb", "200bb"]).default("100bb"),
  villainAlwaysRaise: z.boolean().default(false),
  positions: z
    .array(z.enum(["UTG", "HJ", "CO", "BTN", "SB", "BB"]))
    .min(1, "At least one position must be selected")
    .default(["BB", "SB"]),
  potTypes: z
    .array(z.enum(["SRP", "3BP"]))
    .min(1, "At least one pot type must be selected")
    .default(["SRP"]),
  handCountTarget: z
    .number()
    .int()
    .min(1, "Hand count target must be at least 1")
    .max(1000, "Hand count target must be at most 1000")
    .optional(),
});

/**
 * Validate a config object against the schema.
 * Returns the validated config with defaults applied, or null if invalid.
 */
export function validateConfig(input: unknown): TrainerConfig | null {
  const result = trainerConfigSchema.safeParse(input);
  if (result.success) {
    return result.data as TrainerConfig;
  }
  return null;
}

/**
 * Get the default trainer configuration.
 */
export function getDefaultConfig(): TrainerConfig {
  return trainerConfigSchema.parse({}) as TrainerConfig;
}
