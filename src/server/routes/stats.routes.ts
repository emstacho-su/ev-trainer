/**
 * Overview: Statistics API route definitions.
 * Interacts with: stats controllers and auth middleware.
 * Importance: Exposes aggregated stats endpoints for dashboard visualizations.
 */

import { Router } from "express";
import { requireAuth, optionalAuth } from "../auth/auth.middleware";

// In dev mode, use optionalAuth so the dashboard works without login UI.
// In production, switch back to requireAuth once login page exists.
const authMiddleware = process.env.NODE_ENV === "production" ? requireAuth : optionalAuth;
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

// All stats routes require authentication (optionalAuth in dev until login UI exists)
router.get("/performance", authMiddleware, getPerformanceStats);
router.get("/positions", authMiddleware, getPositionStats);
router.get("/sessions", authMiddleware, getSessionHistory);
router.get("/sessions/:sessionId", authMiddleware, getSessionDetailEndpoint);
router.delete("/sessions/:sessionId", authMiddleware, deleteSessionEndpoint);
router.patch("/sessions/:sessionId/entries/:entryIndex/flag", authMiddleware, toggleHandFlag);
router.get("/flagged", authMiddleware, getFlaggedHands);

export default router;
