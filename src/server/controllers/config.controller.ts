/**
 * Overview: Express controllers for trainer config API endpoints.
 * Interacts with: Prisma client for user preferences, Zod for validation.
 * Importance: Server-side persistence for cross-device config sync.
 */

import type { Request, Response } from "express";
import prisma from "../../lib/prisma/client";
import { trainerConfigSchema, getDefaultConfig } from "../../lib/v2/config/validation";

/**
 * GET /api/config
 * Returns the authenticated user's trainer preferences, or defaults if none stored.
 */
export async function getTrainerConfig(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { trainerPreferences: true },
    });

    if (!user) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
      return;
    }

    // Return stored preferences or defaults
    if (user.trainerPreferences) {
      const validated = trainerConfigSchema.safeParse(user.trainerPreferences);
      if (validated.success) {
        res.status(200).json(validated.data);
        return;
      }
      // Stored preferences are invalid (schema changed) - return defaults
      console.warn("Stored trainer preferences failed validation for user:", userId);
    }

    res.status(200).json(getDefaultConfig());
  } catch (error) {
    console.error("Error fetching trainer config:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch trainer config" },
    });
  }
}

/**
 * POST /api/config
 * Saves the authenticated user's trainer preferences to the database.
 */
export async function updateTrainerConfig(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    // Validate request body
    const result = trainerConfigSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: "INVALID_ARGUMENT",
          message: "Invalid trainer config",
          details: { issues: result.error.issues },
        },
      });
      return;
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
      return;
    }

    // Update preferences
    await prisma.user.update({
      where: { id: userId },
      data: { trainerPreferences: result.data },
    });

    res.status(200).json(result.data);
  } catch (error) {
    console.error("Error updating trainer config:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to update trainer config" },
    });
  }
}
