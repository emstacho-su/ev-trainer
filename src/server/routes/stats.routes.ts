/**
 * Overview: Statistics API route definitions.
 * Interacts with: stats controllers and auth middleware.
 * Importance: Exposes aggregated stats endpoints for dashboard visualizations.
 */

import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import {
  getPerformanceStats,
  getPositionStats,
  getSessionHistory,
  getSessionDetailEndpoint,
  deleteSessionEndpoint,
  toggleHandFlag,
  getFlaggedHands,
} from "../controllers/stats.controller";

const router = Router();

// All stats routes require authentication
router.get("/performance", requireAuth, getPerformanceStats);
router.get("/positions", requireAuth, getPositionStats);
router.get("/sessions", requireAuth, getSessionHistory);
router.get("/sessions/:sessionId", requireAuth, getSessionDetailEndpoint);
router.delete("/sessions/:sessionId", requireAuth, deleteSessionEndpoint);
router.patch("/sessions/:sessionId/entries/:entryIndex/flag", requireAuth, toggleHandFlag);
router.get("/flagged", requireAuth, getFlaggedHands);

export default router;
