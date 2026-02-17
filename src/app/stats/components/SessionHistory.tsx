"use client";

/**
 * Overview: Session history table with sortable columns, pagination, and expand/collapse detail.
 * Interacts with: /api/stats/sessions and /api/stats/sessions/:id endpoints.
 * Importance: Enables review of past training sessions and identification of patterns and mistakes.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import type {
  SessionSummary,
  SessionHistoryResponse,
  SessionDetail,
  SessionEntryDetail,
} from "../../../lib/stats/types";

type SortField = "createdAt" | "accuracy" | "avgEVLoss";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 20;

function getAccessToken(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("access_token") ?? "";
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Check if a date is within the last 24 hours. */
function isRecent(dateStr: string | Date): boolean {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  return date.getTime() > twentyFourHoursAgo;
}

/** Format seconds into a human-readable duration string. */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

/** Sort arrow indicator for column headers. */
function SortArrow({
  field,
  currentField,
  direction,
}: {
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
}) {
  if (field !== currentField) {
    return <span className="ml-1 text-slate-600">&udarr;</span>;
  }
  return (
    <span className="ml-1 text-blue-400">
      {direction === "asc" ? "\u2191" : "\u2193"}
    </span>
  );
}

/** Toggle flag for a session entry via API. */
async function toggleFlag(
  sessionId: string,
  entryIndex: number
): Promise<{ isFlagged: boolean } | null> {
  try {
    const res = await fetch(
      `/api/stats/sessions/${sessionId}/entries/${entryIndex}/flag`,
      {
        method: "PATCH",
        headers: authHeaders(),
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as { isFlagged: boolean };
  } catch {
    return null;
  }
}

/** Expanded detail showing all entries with flag buttons and biggest mistakes. */
function SessionEntries({
  detail,
  onFlagToggle,
}: {
  detail: SessionDetail;
  onFlagToggle: (entryIndex: number, isFlagged: boolean) => void;
}) {
  const [togglingIndex, setTogglingIndex] = useState<number | null>(null);

  async function handleToggleFlag(sessionId: string, entry: SessionEntryDetail) {
    setTogglingIndex(entry.index);
    const result = await toggleFlag(sessionId, entry.index);
    if (result !== null) {
      onFlagToggle(entry.index, result.isFlagged);
    }
    setTogglingIndex(null);
  }

  return (
    <div className="space-y-4">
      {/* All entries */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          All Hands
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-1 pr-3">Flag</th>
                <th className="pb-1 pr-4">Hand #</th>
                <th className="pb-1 pr-4">Spot</th>
                <th className="pb-1 pr-4">Your Action</th>
                <th className="pb-1 pr-4">Result</th>
                <th className="pb-1">EV Diff</th>
              </tr>
            </thead>
            <tbody>
              {detail.entries.map((entry) => {
                const evDiff = entry.result?.evDiff ?? 0;
                const grade = entry.result?.grade ?? "PENDING";
                const isCorrect = grade === "CORRECT" || grade === "OPTIMAL";
                const isFlagged = entry.isFlagged ?? false;

                return (
                  <tr
                    key={entry.id}
                    className="border-t border-slate-700/50"
                  >
                    <td className="py-1.5 pr-3">
                      <button
                        className={`rounded px-1.5 py-0.5 text-sm transition-colors ${
                          isFlagged
                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                            : "bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                        }`}
                        onClick={() => handleToggleFlag(detail.id, entry)}
                        disabled={togglingIndex === entry.index}
                        title={isFlagged ? "Unflag hand" : "Flag hand"}
                      >
                        {isFlagged ? "\u2605" : "\u2606"}
                      </button>
                    </td>
                    <td className="py-1.5 pr-4 text-slate-300">
                      #{entry.index + 1}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-300">
                      {entry.spotId.slice(0, 8)}
                    </td>
                    <td className="py-1.5 pr-4 text-slate-300">
                      {entry.actionId}
                    </td>
                    <td className={`py-1.5 pr-4 ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                      {grade}
                    </td>
                    <td className="py-1.5 font-mono text-slate-300">
                      {evDiff === 0 ? "-" : `${Math.abs(evDiff).toFixed(3)} BB`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Biggest mistakes section */}
      {detail.biggestMistakes.length > 0 && (
        <div className="space-y-2 border-t border-slate-700 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Biggest Mistakes
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="pb-1 pr-4">Hand #</th>
                  <th className="pb-1 pr-4">Spot</th>
                  <th className="pb-1 pr-4">Your Action</th>
                  <th className="pb-1 pr-4">EV Loss</th>
                  <th className="pb-1">Optimal Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.biggestMistakes.map((entry: SessionEntryDetail) => {
                  const evDiff = entry.result?.evDiff ?? 0;
                  const allActions = entry.result?.allActions ?? [];

                  return (
                    <tr
                      key={entry.id}
                      className="border-t border-slate-700/50"
                    >
                      <td className="py-1.5 pr-4 text-slate-300">
                        #{entry.index + 1}
                      </td>
                      <td className="py-1.5 pr-4 text-slate-300">
                        {entry.spotId.slice(0, 8)}
                      </td>
                      <td className="py-1.5 pr-4 text-slate-300">
                        {entry.actionId}
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-red-400">
                        {Math.abs(evDiff).toFixed(3)} BB
                      </td>
                      <td className="py-1.5 text-slate-400">
                        {allActions.length > 0
                          ? allActions
                              .sort((a, b) => b.ev - a.ev)
                              .slice(0, 3)
                              .map(
                                (a) =>
                                  `${a.actionId} (${(a.frequency * 100).toFixed(0)}%)`
                              )
                              .join(", ")
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionHistory() {
  const searchParams = useSearchParams();

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Data
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting (client-side for current page; server returns by createdAt desc)
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Expanded session detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<SessionDetail | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);

  // Read date range from search params
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  const fetchSessions = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        params.set("page", String(pageNum));
        params.set("pageSize", String(PAGE_SIZE));

        const res = await fetch(`/api/stats/sessions?${params.toString()}`, {
          headers: authHeaders(),
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "Please log in to view session history."
              : "Failed to load sessions."
          );
        }

        const data = (await res.json()) as SessionHistoryResponse;
        setSessions(data.sessions);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(data.page);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load sessions.";
        setError(msg);
        setSessions([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate]
  );

  // Fetch sessions on mount and when date range changes
  useEffect(() => {
    void fetchSessions(1);
  }, [fetchSessions]);

  // Fetch detail when expanding a session
  async function handleExpand(sessionId: string) {
    if (expandedId === sessionId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }

    setExpandedId(sessionId);
    setExpandedDetail(null);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/stats/sessions/${sessionId}`, {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load session detail.");
      const data = (await res.json()) as SessionDetail;
      setExpandedDetail(data);
    } catch {
      setExpandedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  // Delete session with confirmation
  async function handleDelete(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this session? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/stats/sessions/${sessionId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) throw new Error("Failed to delete session.");

      // Remove from local state
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setTotal((prev) => prev - 1);

      if (expandedId === sessionId) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
    } catch {
      alert("Failed to delete session. Please try again.");
    }
  }

  // Sort handler
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "createdAt" ? "desc" : "desc");
    }
  }

  // Sort sessions locally
  const sortedSessions = [...sessions].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortField) {
      case "createdAt":
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
      case "accuracy":
        aVal = a.accuracy;
        bVal = b.accuracy;
        break;
      case "avgEVLoss":
        aVal = a.avgEVLoss;
        bVal = b.avgEVLoss;
        break;
    }

    return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
  });

  // Pagination display
  const rangeStart = (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  // Loading state
  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-400">Loading sessions...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!loading && sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 py-12">
        <p className="text-sm text-slate-400">No sessions found.</p>
        <p className="text-xs text-slate-500">
          Complete a training session to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 hover:text-slate-200"
                onClick={() => handleSort("createdAt")}
              >
                Date
                <SortArrow
                  field="createdAt"
                  currentField={sortField}
                  direction={sortDirection}
                />
              </th>
              <th className="px-4 py-3">Hands</th>
              <th
                className="cursor-pointer px-4 py-3 hover:text-slate-200"
                onClick={() => handleSort("accuracy")}
              >
                Accuracy
                <SortArrow
                  field="accuracy"
                  currentField={sortField}
                  direction={sortDirection}
                />
              </th>
              <th
                className="cursor-pointer px-4 py-3 hover:text-slate-200"
                onClick={() => handleSort("avgEVLoss")}
              >
                Avg EV Loss
                <SortArrow
                  field="avgEVLoss"
                  currentField={sortField}
                  direction={sortDirection}
                />
              </th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.map((session) => {
              const recent = isRecent(session.createdAt);
              const isExpanded = expandedId === session.id;

              return (
                <tr key={session.id} className="group">
                  {/* Main row */}
                  <td
                    colSpan={6}
                    className="p-0"
                  >
                    <div
                      className={`flex cursor-pointer items-center border-b border-slate-800 transition-colors hover:bg-slate-800/50 ${
                        recent ? "border-l-2 border-l-blue-500" : ""
                      } ${isExpanded ? "bg-slate-800/30" : ""}`}
                      onClick={() => handleExpand(session.id)}
                    >
                      {/* Date */}
                      <div className="flex min-w-[160px] items-center gap-2 px-4 py-3">
                        <span className="text-slate-200">
                          {format(
                            new Date(session.createdAt),
                            "MMM d, yyyy HH:mm"
                          )}
                        </span>
                        {recent && (
                          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                            recent
                          </span>
                        )}
                      </div>

                      {/* Hands */}
                      <div className="min-w-[80px] px-4 py-3 text-slate-300">
                        {session.decisionsCompleted}/{session.decisionsPerSession}
                      </div>

                      {/* Accuracy */}
                      <div className="min-w-[100px] px-4 py-3">
                        <span
                          className={
                            session.accuracy >= 70
                              ? "text-green-400"
                              : session.accuracy >= 50
                                ? "text-yellow-400"
                                : "text-red-400"
                          }
                        >
                          {session.accuracy.toFixed(1)}%
                        </span>
                      </div>

                      {/* Avg EV Loss */}
                      <div className="min-w-[110px] px-4 py-3 font-mono text-slate-300">
                        {session.avgEVLoss.toFixed(3)} BB
                      </div>

                      {/* Duration */}
                      <div className="min-w-[100px] px-4 py-3 text-slate-400">
                        {formatDuration(session.duration)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 px-4 py-3">
                        <button
                          className="rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExpand(session.id);
                          }}
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </button>
                        <button
                          className="rounded px-2 py-1 text-xs text-red-400/70 transition-colors hover:bg-red-950/50 hover:text-red-400"
                          onClick={(e) => handleDelete(session.id, e)}
                          title="Delete session"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-b border-slate-700 bg-slate-850 px-6 py-4">
                        {detailLoading ? (
                          <p className="text-sm text-slate-400">
                            Loading details...
                          </p>
                        ) : expandedDetail ? (
                          <SessionEntries
                            detail={expandedDetail}
                            onFlagToggle={(entryIndex, isFlagged) => {
                              setExpandedDetail((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  entries: prev.entries.map((e) =>
                                    e.index === entryIndex
                                      ? { ...e, isFlagged }
                                      : e
                                  ),
                                };
                              });
                            }}
                          />
                        ) : (
                          <p className="text-sm text-slate-500">
                            Could not load session details.
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-400">
            Showing {rangeStart}-{rangeEnd} of {total} sessions
          </p>
          <div className="flex gap-2">
            <button
              className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => fetchSessions(page - 1)}
            >
              Previous
            </button>
            <button
              className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!hasMore}
              onClick={() => fetchSessions(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
