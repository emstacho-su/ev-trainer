/**
 * Overview: Drill suggestion computation from SpotStat data.
 * Interacts with: Prisma SpotStat model to identify weakest spots.
 * Importance: Surfaces user's worst-performing spots as actionable drill suggestions.
 */

import prisma from "../../prisma/client";

/** Minimum number of decisions before a spot is considered for suggestions. */
const MIN_DECISIONS_THRESHOLD = 10;

/** Maximum number of drill suggestions to return. */
const MAX_SUGGESTIONS = 3;

export interface DrillSuggestion {
  /** Human-readable spot label, e.g. "BB vs CO" */
  spotLabel: string;
  /** Accuracy as a percentage (0-100) */
  accuracy: number;
  /** Average EV loss per hand (higher = worse) */
  avgEvLoss: number;
  /** Pre-filled position filter values */
  positions: string[];
  /** Pre-filled pot type filter values */
  potTypes: string[];
}

/**
 * Compute top drill suggestions for a user based on their weakest spots.
 *
 * Queries SpotStat records with sufficient data (>= MIN_DECISIONS_THRESHOLD),
 * sorts by accuracy ascending (worst first), and returns up to MAX_SUGGESTIONS.
 */
export async function computeDrillSuggestions(
  userId: string
): Promise<DrillSuggestion[]> {
  const spotStats = await prisma.spotStat.findMany({
    where: {
      userId,
      totalDecisions: { gte: MIN_DECISIONS_THRESHOLD },
    },
    orderBy: { avgEvLoss: "desc" },
    take: MAX_SUGGESTIONS,
  });

  return spotStats.map((stat) => {
    const accuracy =
      stat.totalDecisions > 0
        ? (stat.correctDecisions / stat.totalDecisions) * 100
        : 0;

    // Build spot label from hero/villain positions
    const spotLabel = stat.villainPosition
      ? `${stat.heroPosition} vs ${stat.villainPosition}`
      : stat.heroPosition;

    return {
      spotLabel,
      accuracy,
      avgEvLoss: Number(stat.avgEvLoss),
      positions: [stat.heroPosition],
      potTypes: [] as string[], // SpotStat doesn't store pot type; leave empty
    };
  });
}
