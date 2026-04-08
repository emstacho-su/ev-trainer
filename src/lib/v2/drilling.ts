// src/lib/v2/drilling.ts
// Builds targeted drill sessions from stats-identified weaknesses.
// Consolidates the position/pot-type filtering logic used by
// DrillSuggestions and WeaknessBreakdown into a single module.

import type { TrainerConfig, ConfigPosition, ConfigPotType } from './config/types';
import { getDefaultConfig } from './config/validation';

/** Stats for a weak spot, as surfaced by the stats API. */
export interface WeakSpot {
  heroPosition: string;
  villainPosition?: string | null;
  street: string;
  accuracy: number;
  avgEvLoss: number;
  totalDecisions: number;
}

/** A drill session config ready to start training. */
export interface DrillSessionConfig {
  config: TrainerConfig;
  /** URL query params for navigating to training page. */
  urlParams: Record<string, string>;
}

/**
 * Create a targeted drill session from a weak spot.
 * Pre-fills position filters and mode based on the spot's street,
 * keeping other settings at their current/default values.
 *
 * @param weakSpot - The stats-identified weakness to drill
 * @param currentConfig - Current trainer config (optional, uses defaults if not provided)
 */
export function createDrillSession(
  weakSpot: WeakSpot,
  currentConfig?: Partial<TrainerConfig>,
): DrillSessionConfig {
  const base = { ...getDefaultConfig(), ...currentConfig };

  // Map street to training mode
  const mode = weakSpot.street === 'PREFLOP' ? 'PREFLOP' : 'FLOP';

  // Map hero position to config positions (filter to just this position)
  const heroPos = weakSpot.heroPosition.toUpperCase() as ConfigPosition;
  const validPositions: ConfigPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const positions = validPositions.includes(heroPos) ? [heroPos] : base.positions;

  const config: TrainerConfig = {
    ...base,
    mode,
    positions,
    handCountTarget: 20, // Focused drill: 20 hands
  };

  // Build URL params for navigation
  const urlParams: Record<string, string> = {
    heroPosition: weakSpot.heroPosition,
  };
  if (weakSpot.villainPosition) {
    urlParams.villainPosition = weakSpot.villainPosition;
  }

  return { config, urlParams };
}

/**
 * Build a training URL with drill parameters.
 * Used by the "Drill this" buttons in stats and suggestions.
 */
export function buildDrillUrl(drill: DrillSessionConfig): string {
  const params = new URLSearchParams(drill.urlParams);
  return `/training?${params.toString()}`;
}

/**
 * Identify the top N weakest spots from a list, sorted by worst accuracy.
 * Filters to spots with at least `minDecisions` for statistical significance.
 */
export function rankWeakSpots(
  spots: WeakSpot[],
  count: number = 5,
  minDecisions: number = 10,
): WeakSpot[] {
  return spots
    .filter((s) => s.totalDecisions >= minDecisions)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, count);
}
