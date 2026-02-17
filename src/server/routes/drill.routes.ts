/**
 * Overview: Drill API route definitions.
 * Interacts with: drill controller and auth middleware.
 * Importance: Exposes drill suggestion endpoints for authenticated users.
 */

import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { getSuggestions } from "../controllers/drill.controller";

const router = Router();

// GET /api/drills/suggestions - returns personalized drill suggestions
router.get("/suggestions", requireAuth, getSuggestions);

export default router;
