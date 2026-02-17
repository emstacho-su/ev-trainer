/**
 * Overview: Express controllers for statistics API endpoints.
 * Interacts with: aggregation queries for data, auth middleware for user context.
 * Importance: Surfaces aggregated stats for dashboard visualizations.
 */

import type { Request, Response } from "express";
import {
  getDailyStats,
  getPositionBreakdown,
  getSessionList,
  getSessionDetail,
  deleteUserSession,
  toggleEntryFlag,
  getFlaggedEntries,
} from "../../lib/stats/aggregation";
import type {
  PerformanceStatsResponse,
  PositionStatsResponse,
  SessionHistoryResponse,
  StatsFilters,
} from "../../lib/stats/types";

const LOW_CONFIDENCE_THRESHOLD = 20;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Get userId from auth or return 401. In dev, falls back to first user in DB. */
async function getUserId(req: Request, res: Response): Promise<string | null> {
  if (req.user?.userId) return req.user.userId;
  if (process.env.NODE_ENV === "production") {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    return null;
  }
  // Dev fallback: use first user in database
  const mod = await import("../../lib/prisma/client");
  const prisma = mod.default;
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    res.status(401).json({ error: { code: "NO_USER", message: "No users in database. Run seed script." } });
    return null;
  }
  return user.id;
}

/**
 * Parse date range from query params with defaults.
 * Default: last 30 days.
 */
function parseDateFilters(query: Record<string, unknown>): StatsFilters {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const startDate = typeof query.startDate === "string"
    ? new Date(query.startDate)
    : thirtyDaysAgo;

  const endDate = typeof query.endDate === "string"
    ? new Date(query.endDate)
    : now;

  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Invalid date format");
  }

  const positions = typeof query.positions === "string"
    ? query.positions.split(",").filter(Boolean)
    : undefined;

  const scenarios = typeof query.scenarios === "string"
    ? query.scenarios.split(",").filter(Boolean)
    : undefined;

  const streets = typeof query.streets === "string"
    ? query.streets.split(",").filter(Boolean)
    : undefined;

  return { startDate, endDate, positions, scenarios, streets };
}

/**
 * GET /api/stats/performance
 * Returns daily performance metrics for time-series charts.
 */
export async function getPerformanceStats(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;
    const filters = parseDateFilters(req.query as Record<string, unknown>);

    const metrics = await getDailyStats(userId, filters);

    // Determine granularity based on date range
    const daySpan =
      (filters.endDate.getTime() - filters.startDate.getTime()) /
      (1000 * 60 * 60 * 24);
    const granularity: PerformanceStatsResponse["granularity"] =
      daySpan <= 7 ? "session" : daySpan <= 90 ? "day" : "week";

    const response: PerformanceStatsResponse = { metrics, granularity };
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid date format") {
      res.status(400).json({
        error: { code: "INVALID_ARGUMENT", message: "Invalid date format. Use ISO date strings." },
      });
      return;
    }
    console.error("Error fetching performance stats:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch performance stats" },
    });
  }
}

/**
 * GET /api/stats/positions
 * Returns position-based performance breakdown for heatmap.
 */
export async function getPositionStats(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;
    const filters = parseDateFilters(req.query as Record<string, unknown>);

    const stats = await getPositionBreakdown(userId, filters);

    const response: PositionStatsResponse = {
      stats,
      lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    };
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid date format") {
      res.status(400).json({
        error: { code: "INVALID_ARGUMENT", message: "Invalid date format. Use ISO date strings." },
      });
      return;
    }
    console.error("Error fetching position stats:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch position stats" },
    });
  }
}

/**
 * GET /api/stats/sessions
 * Returns paginated session history.
 */
export async function getSessionHistory(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;
    const filters = parseDateFilters(req.query as Record<string, unknown>);

    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(String(req.query.pageSize), 10) || DEFAULT_PAGE_SIZE)
    );

    const { sessions, total } = await getSessionList(
      userId,
      filters,
      page,
      pageSize
    );

    const response: SessionHistoryResponse = {
      sessions,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
    res.status(200).json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid date format") {
      res.status(400).json({
        error: { code: "INVALID_ARGUMENT", message: "Invalid date format. Use ISO date strings." },
      });
      return;
    }
    console.error("Error fetching session history:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch session history" },
    });
  }
}

/**
 * GET /api/stats/sessions/:sessionId
 * Returns detailed session with entries and biggest mistakes.
 */
export async function getSessionDetailEndpoint(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;
    const sessionIdParam = req.params.sessionId;
    const sessionId = typeof sessionIdParam === "string" ? sessionIdParam : "";

    if (!sessionId) {
      res.status(400).json({
        error: { code: "INVALID_ARGUMENT", message: "Session ID is required" },
      });
      return;
    }

    const detail = await getSessionDetail(sessionId, userId);

    if (!detail) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Session not found" },
      });
      return;
    }

    res.status(200).json(detail);
  } catch (error) {
    console.error("Error fetching session detail:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch session detail" },
    });
  }
}

/**
 * DELETE /api/stats/sessions/:sessionId
 * Deletes a session (ownership verified).
 */
export async function deleteSessionEndpoint(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;
    const sessionIdParam = req.params.sessionId;
    const sessionId = typeof sessionIdParam === "string" ? sessionIdParam : "";

    if (!sessionId) {
      res.status(400).json({
        error: { code: "INVALID_ARGUMENT", message: "Session ID is required" },
      });
      return;
    }

    const deleted = await deleteUserSession(sessionId, userId);

    if (!deleted) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Session not found" },
      });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to delete session" },
    });
  }
}

/**
 * PATCH /api/stats/sessions/:sessionId/entries/:entryIndex/flag
 * Toggles the isFlagged state for a session entry.
 */
export async function toggleHandFlag(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;
    const sessionIdParam = req.params.sessionId;
    const entryIndexParam = req.params.entryIndex;

    const sessionId = typeof sessionIdParam === "string" ? sessionIdParam : "";
    const entryIndex = parseInt(String(entryIndexParam), 10);

    if (!sessionId || isNaN(entryIndex)) {
      res.status(400).json({
        error: { code: "INVALID_ARGUMENT", message: "Session ID and entry index are required" },
      });
      return;
    }

    const result = await toggleEntryFlag(sessionId, entryIndex, userId);

    if (!result) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Session entry not found" },
      });
      return;
    }

    res.status(200).json({ isFlagged: result.isFlagged });
  } catch (error) {
    console.error("Error toggling hand flag:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to toggle hand flag" },
    });
  }
}

/**
 * GET /api/stats/flagged
 * Returns all flagged session entries for the authenticated user.
 */
export async function getFlaggedHands(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = await getUserId(req, res);
    if (!userId) return;
    const entries = await getFlaggedEntries(userId);
    res.status(200).json({ entries });
  } catch (error) {
    console.error("Error fetching flagged hands:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch flagged hands" },
    });
  }
}
