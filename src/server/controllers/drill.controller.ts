/**
 * Overview: Express controller for drill suggestion endpoints.
 * Interacts with: computeDrillSuggestions for data, auth middleware for user context.
 * Importance: Surfaces personalized drill recommendations via API.
 */

import type { Request, Response } from "express";
import { computeDrillSuggestions } from "../../lib/v2/api/drillSuggestions";

/**
 * GET /api/drills/suggestions
 * Returns up to 3 drill suggestions based on user's weakest spots.
 */
export async function getSuggestions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const suggestions = await computeDrillSuggestions(userId);
    res.status(200).json(suggestions);
  } catch (error) {
    console.error("Error fetching drill suggestions:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to fetch drill suggestions",
      },
    });
  }
}
