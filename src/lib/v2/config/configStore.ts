/**
 * Overview: localStorage persistence layer for trainer configuration.
 * Interacts with: validation schemas for safe deserialization, browser localStorage API.
 * Importance: Provides fast client-side config persistence across browser sessions.
 *
 * This handles browser-side persistence only. Server-side sync for authenticated
 * users is handled separately by the useTrainerConfig hook and /api/config endpoints.
 */

import type { TrainerConfig } from "./types";
import { trainerConfigSchema, getDefaultConfig } from "./validation";

const STORAGE_KEY = "trainer-config";

/**
 * Load trainer config from localStorage.
 *
 * - Returns default config if no stored value exists
 * - Returns default config if stored value fails Zod validation (schema change, corrupt data)
 * - Handles localStorage being unavailable (SSR, disabled, etc.)
 */
export function loadConfigFromStorage(): TrainerConfig {
  try {
    if (typeof localStorage === "undefined") {
      return getDefaultConfig();
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getDefaultConfig();
    }

    const parsed = JSON.parse(raw);
    const result = trainerConfigSchema.safeParse(parsed);

    if (result.success) {
      return result.data as TrainerConfig;
    }

    // Validation failed - stored config is outdated or corrupt
    console.warn(
      "Stored trainer config failed validation, using defaults:",
      result.error.message
    );
    return getDefaultConfig();
  } catch (error) {
    // JSON parse error, localStorage access error, etc.
    console.warn("Failed to load trainer config from storage:", error);
    return getDefaultConfig();
  }
}

/**
 * Save trainer config to localStorage.
 *
 * - Validates config before saving (prevents storing invalid state)
 * - Handles localStorage quota errors gracefully (logs but doesn't throw)
 * - No-op if localStorage is unavailable (SSR)
 */
export function saveConfigToStorage(config: TrainerConfig): void {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }

    // Validate before saving to prevent storing invalid state
    const validated = trainerConfigSchema.parse(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  } catch (error) {
    // Quota exceeded, validation error, or localStorage unavailable
    console.warn("Failed to save trainer config to storage:", error);
  }
}
