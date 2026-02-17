"use client";

/**
 * Overview: Table showing top 10 weakest position matchups with drill buttons.
 * Interacts with: /api/stats/positions endpoint, navigates to /lobby for targeted training.
 * Importance: Bridges insight to action by surfacing weakest spots and enabling drill navigation.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PositionStat, PositionStatsResponse } from "../../../lib/stats/types";

interface WeaknessRow {
  heroPosition: string;
  villainPosition: string;
  hands: number;
  accuracy: number;
  avgEVLoss: number;
}

function buildWeaknesses(stats: PositionStat[]): WeaknessRow[] {
  return stats
    .filter((s) => s.confidence && s.villainPosition !== null)
    .map((s) => ({
      heroPosition: s.heroPosition,
      villainPosition: s.villainPosition!,
      hands: s.hands,
      accuracy: s.accuracy,
      avgEVLoss: s.avgEVLoss,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);
}

export default function WeaknessBreakdown() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [rows, setRows] = useState<WeaknessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("accessToken");
        const params = new URLSearchParams();
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const url = `/api/stats/positions${params.toString() ? `?${params.toString()}` : ""}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch position stats");
        }

        const data: PositionStatsResponse = await res.json();
        if (!mounted) return;

        setRows(buildWeaknesses(data.stats));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load weakness data");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  function handleDrill(heroPosition: string, villainPosition: string) {
    const params = new URLSearchParams();
    params.set("heroPosition", heroPosition);
    params.set("villainPosition", villainPosition);
    router.push(`/lobby?${params.toString()}`);
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">Weakness Breakdown</h2>

      {loading && (
        <p className="py-6 text-center text-sm text-slate-400">Loading weakness data...</p>
      )}

      {error && (
        <p className="rounded border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-400">
          No weaknesses detected. Keep training!
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">Matchup</th>
                <th className="pb-2 pr-4">Hands</th>
                <th className="pb-2 pr-4">Accuracy</th>
                <th className="pb-2 pr-4">Avg EV Loss</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.heroPosition}-${row.villainPosition}`}
                  className="border-b border-slate-800 last:border-b-0"
                >
                  <td className="py-2.5 pr-4 font-medium text-slate-200">
                    <span className="text-blue-400">{row.heroPosition}</span>
                    <span className="mx-1 text-slate-500">vs</span>
                    <span className="text-orange-400">{row.villainPosition}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-400">{row.hands}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={
                        row.accuracy < 50
                          ? "text-red-400"
                          : row.accuracy < 70
                            ? "text-yellow-400"
                            : "text-slate-300"
                      }
                    >
                      {row.accuracy.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-300">
                    {row.avgEVLoss.toFixed(3)} BB
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleDrill(row.heroPosition, row.villainPosition)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500"
                    >
                      Drill this
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
