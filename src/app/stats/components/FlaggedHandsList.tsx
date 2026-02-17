"use client";

/**
 * Overview: Dedicated list of flagged (bookmarked) hands for later review.
 * Interacts with: GET /api/stats/flagged, PATCH /api/stats/sessions/:id/entries/:index/flag.
 * Importance: Allows users to revisit challenging spots they flagged during session review.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import type { FlaggedEntry } from "../../../lib/stats/types";

function getAccessToken(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("access_token") ?? "";
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function FlaggedHandsList() {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<FlaggedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unflaggingId, setUnflaggingId] = useState<string | null>(null);

  const fetchFlagged = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const positions = searchParams.get("positions");
      const scenarios = searchParams.get("scenarios");
      const streets = searchParams.get("streets");
      if (positions) params.set("positions", positions);
      if (scenarios) params.set("scenarios", scenarios);
      if (streets) params.set("streets", streets);

      const queryStr = params.toString();
      const res = await fetch(`/api/stats/flagged${queryStr ? `?${queryStr}` : ""}`, {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Please log in to view flagged hands."
            : "Failed to load flagged hands."
        );
      }

      const data = (await res.json()) as { entries: FlaggedEntry[] };
      setEntries(data.entries);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load flagged hands.";
      setError(msg);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void fetchFlagged();
  }, [fetchFlagged]);

  async function handleUnflag(entry: FlaggedEntry) {
    setUnflaggingId(entry.id);

    try {
      const res = await fetch(
        `/api/stats/sessions/${entry.sessionId}/entries/${entry.index}/flag`,
        {
          method: "PATCH",
          headers: authHeaders(),
        }
      );

      if (res.ok) {
        // Remove from list optimistically
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      }
    } catch {
      // Silently fail; entry stays in list
    } finally {
      setUnflaggingId(null);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-400">Loading flagged hands...</p>
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
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 py-12">
        <p className="text-sm text-slate-400">No flagged hands yet.</p>
        <p className="text-xs text-slate-500">
          Expand a session and click the star icon to flag challenging hands for review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-300">
        Flagged Hands ({entries.length})
      </h3>

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Session Date</th>
              <th className="px-4 py-3">Hand #</th>
              <th className="px-4 py-3">Spot</th>
              <th className="px-4 py-3">Your Action</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">EV Loss</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isCorrect =
                entry.grade === "CORRECT" || entry.grade === "OPTIMAL";
              const evDiff = entry.evDiff;

              return (
                <tr
                  key={entry.id}
                  className="border-b border-slate-800 transition-colors hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3 text-slate-200">
                    {format(new Date(entry.sessionDate), "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    #{entry.index + 1}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {entry.spotId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {entry.actionId}
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      isCorrect ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {entry.grade}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {evDiff === 0
                      ? "-"
                      : `${Math.abs(evDiff).toFixed(3)} BB`}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="rounded bg-slate-700/50 px-2 py-1 text-xs text-yellow-400 transition-colors hover:bg-slate-700 hover:text-yellow-300"
                      onClick={() => handleUnflag(entry)}
                      disabled={unflaggingId === entry.id}
                      title="Unflag hand"
                    >
                      {unflaggingId === entry.id ? "..." : "Unflag"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
