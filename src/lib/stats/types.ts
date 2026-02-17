/**
 * Overview: TypeScript type definitions for statistics data structures.
 * Interacts with: aggregation queries, stats controllers, frontend dashboard.
 * Importance: Ensures type safety across the entire stats pipeline.
 */

// Performance metrics for time-series charts
export interface PerformanceDataPoint {
  date: string;              // ISO date string
  hands: number;             // Total hands played
  accuracy: number;          // Percentage (0-100)
  avgEVLoss: number;         // BB (0.5 precision)
  correctFoldPct: number;    // Percentage (0-100)
  correctRaisePct: number;   // Percentage (0-100)
  sessionCount: number;      // Number of sessions
}

// Position-based stats for heatmap
export interface PositionStat {
  heroPosition: string;      // Position
  villainPosition: string | null;
  hands: number;
  accuracy: number;          // Percentage (0-100)
  avgEVLoss: number;         // BB
  confidence: boolean;       // >= threshold (default 20 hands)
}

// Session summary for history list
export interface SessionSummary {
  id: string;
  sessionId: string;
  createdAt: Date;
  decisionsPerSession: number;
  decisionsCompleted: number;
  accuracy: number;          // Percentage (0-100)
  avgEVLoss: number;         // BB
  duration: number;          // Seconds (derived from first/last entry)
  scenarioBreakdown: Record<string, number>; // scenario type -> count
}

// Filter input for stats queries
export interface StatsFilters {
  startDate: Date;
  endDate: Date;
  positions?: string[];      // Filter by position
  scenarios?: string[];      // Filter by scenario type
}

// API response types
export interface PerformanceStatsResponse {
  metrics: PerformanceDataPoint[];
  granularity: "session" | "day" | "week";
}

export interface PositionStatsResponse {
  stats: PositionStat[];
  lowConfidenceThreshold: number;
}

export interface SessionHistoryResponse {
  sessions: SessionSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Session detail with entries for expanded view
export interface SessionDetail {
  id: string;
  sessionId: string;
  createdAt: Date;
  mode: string;
  packId: string;
  decisionsPerSession: number;
  isComplete: boolean;
  entries: SessionEntryDetail[];
  biggestMistakes: SessionEntryDetail[];
}

export interface SessionEntryDetail {
  id: string;
  index: number;
  spotId: string;
  actionId: string;
  isFlagged?: boolean;
  result: {
    grade: string;
    evDiff: number;
    allActions?: Array<{
      actionId: string;
      ev: number;
      frequency: number;
    }>;
  } | null;
}

// Flagged entry with session context for the flagged hands list
export interface FlaggedEntry {
  id: string;
  sessionId: string;
  index: number;
  spotId: string;
  actionId: string;
  sessionDate: Date;
  grade: string;
  evDiff: number;
}
