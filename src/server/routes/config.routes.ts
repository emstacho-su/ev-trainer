/**
 * Overview: Config API route definitions for trainer preferences.
 * Interacts with: config controller, auth middleware.
 * Importance: Enables server-side config persistence for authenticated users.
 */

import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { getTrainerConfig, updateTrainerConfig } from "../controllers/config.controller";

const router = Router();

// GET /api/config - Fetch user's trainer preferences (requires auth)
router.get("/", requireAuth, getTrainerConfig);

// POST /api/config - Save user's trainer preferences (requires auth)
router.post("/", requireAuth, updateTrainerConfig);

export default router;
