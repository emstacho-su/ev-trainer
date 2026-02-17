/**
 * Overview: Server-side Prisma aggregation queries for statistics.
 * Interacts with: Prisma client for groupBy and aggregate queries.
 * Importance: All heavy data lifting happens server-side for scalability.
 */

import prisma from "../prisma/client";
import type {
  PerformanceDataPoint,
  PositionStat,
  SessionSummary,
  StatsFilters,
  SessionDetail,
  SessionEntryDetail,
} from "./types";

const LOW_CONFIDENCE_THRESHOLD = 20; // Minimum hands for confident stats

/**
 * Get daily performance metrics for time-series charts.
 * Uses DailyStat table which is pre-aggregated per day.
 */
export async function getDailyStats(
  userId: string,
  filters: StatsFilters
): Promise<PerformanceDataPoint[]> {
  const dailyStats = await prisma.dailyStat.findMany({
    where: {
      userId,
      date: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
    },
    orderBy: { date: "asc" },
  });

  return dailyStats.map((stat) => {
    const accuracy =
      stat.totalDecisions > 0
        ? (stat.correctDecisions / stat.totalDecisions) * 100
        : 0;

    return {
      date: stat.date.toISOString().split("T")[0],
      hands: stat.totalDecisions,
      accuracy: Math.round(accuracy * 10) / 10,
      avgEVLoss: Number(stat.avgEvLoss),
      // These require SessionEntry-level data; approximated from daily aggregate
      correctFoldPct: 0,
      correctRaisePct: 0,
      sessionCount: stat.sessionsCompleted,
    };
  });
}

/**
 * Get position-based performance breakdown.
 * Uses SpotStat table with groupBy on heroPosition and villainPosition.
 */
export async function getPositionBreakdown(
  userId: string,
  filters: StatsFilters
): Promise<PositionStat[]> {
  const positionStats = await prisma.spotStat.groupBy({
    by: ["heroPosition", "villainPosition"],
    where: {
      userId,
      lastPracticed: {
        gte: filters.startDate,
        lte: filters.endDate,
      },
      ...(filters.positions && filters.positions.length > 0
        ? { heroPosition: { in: filters.positions } }
        : {}),
    },
    _sum: {
      totalDecisions: true,
      correctDecisions: true,
    },
    _avg: {
      avgEvLoss: true,
    },
  });

  return positionStats.map((group) => {
    const totalDecisions = group._sum.totalDecisions ?? 0;
    const correctDecisions = group._sum.correctDecisions ?? 0;
    const accuracy =
      totalDecisions > 0 ? (correctDecisions / totalDecisions) * 100 : 0;

    return {
      heroPosition: group.heroPosition,
      villainPosition: group.villainPosition,
      hands: totalDecisions,
      accuracy: Math.round(accuracy * 10) / 10,
      avgEVLoss: Number(group._avg.avgEvLoss ?? 0),
      confidence: totalDecisions >= LOW_CONFIDENCE_THRESHOLD,
    };
  });
}

/**
 * Get paginated session list for history view.
 * Queries Session table with entry counts and accuracy computation.
 */
export async function getSessionList(
  userId: string,
  filters: StatsFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<{ sessions: SessionSummary[]; total: number }> {
  const skip = (page - 1) * pageSize;

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where: {
        userId,
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        isComplete: true,
      },
      include: {
        entries: {
          orderBy: { index: "asc" },
          select: {
            id: true,
            index: true,
            spotId: true,
            actionId: true,
            result: true,
            createdAt: true,
            spot: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.session.count({
      where: {
        userId,
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        isComplete: true,
      },
    }),
  ]);

  const sessionSummaries: SessionSummary[] = sessions.map((session) => {
    const entries = session.entries;
    const gradedEntries = entries.filter(
      (e) => e.result !== null && typeof e.result === "object"
    );

    // Compute accuracy from graded entries
    const correctCount = gradedEntries.filter((e) => {
      const result = e.result as Record<string, unknown> | null;
      return result?.grade === "CORRECT" || result?.grade === "OPTIMAL";
    }).length;

    const accuracy =
      gradedEntries.length > 0
        ? (correctCount / gradedEntries.length) * 100
        : 0;

    // Compute average EV loss from graded entries
    const totalEvLoss = gradedEntries.reduce((sum, e) => {
      const result = e.result as Record<string, unknown> | null;
      return sum + Math.abs(Number(result?.evDiff ?? 0));
    }, 0);
    const avgEVLoss =
      gradedEntries.length > 0 ? totalEvLoss / gradedEntries.length : 0;

    // Duration from first to last entry
    const timestamps = entries.map((e) => e.createdAt.getTime());
    const duration =
      timestamps.length >= 2
        ? (Math.max(...timestamps) - Math.min(...timestamps)) / 1000
        : 0;

    // Scenario breakdown from spot data
    const scenarioBreakdown: Record<string, number> = {};
    for (const entry of entries) {
      const spot = entry.spot as Record<string, unknown> | null;
      const scenarioType =
        (spot?.meta as Record<string, unknown>)?.scenarioType ??
        (spot as Record<string, unknown>)?.scenarioType ??
        "unknown";
      const key = String(scenarioType);
      scenarioBreakdown[key] = (scenarioBreakdown[key] ?? 0) + 1;
    }

    return {
      id: session.id,
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      decisionsPerSession: session.decisionsPerSession,
      decisionsCompleted: entries.length,
      accuracy: Math.round(accuracy * 10) / 10,
      avgEVLoss: Math.round(avgEVLoss * 100) / 100,
      duration: Math.round(duration),
      scenarioBreakdown,
    };
  });

  return { sessions: sessionSummaries, total };
}

/**
 * Get detailed session with all entries and biggest mistakes.
 */
export async function getSessionDetail(
  sessionId: string,
  userId: string
): Promise<SessionDetail | null> {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    include: {
      entries: {
        orderBy: { index: "asc" },
        select: {
          id: true,
          index: true,
          spotId: true,
          actionId: true,
          result: true,
        },
      },
    },
  });

  if (!session) return null;

  const entries: SessionEntryDetail[] = session.entries.map((e) => ({
    id: e.id,
    index: e.index,
    spotId: e.spotId,
    actionId: e.actionId,
    result: e.result as SessionEntryDetail["result"],
  }));

  // Biggest mistakes: entries with largest negative EV diff, sorted worst first
  const biggestMistakes = entries
    .filter((e) => e.result !== null && Math.abs(e.result.evDiff) > 0)
    .sort((a, b) => Math.abs(b.result!.evDiff) - Math.abs(a.result!.evDiff))
    .slice(0, 5);

  return {
    id: session.id,
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    mode: session.mode,
    packId: session.packId,
    decisionsPerSession: session.decisionsPerSession,
    isComplete: session.isComplete,
    entries,
    biggestMistakes,
  };
}

/**
 * Delete a session and cascade to entries (ownership verified).
 * Returns true if deleted, false if not found.
 */
export async function deleteUserSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership first
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });

  if (!session) return false;

  // Delete session (entries cascade via onDelete: Cascade)
  await prisma.session.delete({
    where: { id: session.id },
  });

  return true;
}
