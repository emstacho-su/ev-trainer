"use client";

/**
 * Overview: 6x6 heatmap grid showing hero vs villain positional performance.
 * Interacts with: /api/stats/positions endpoint, date range from useSearchParams.
 * Importance: Visual identification of positional strengths and weaknesses for targeted training.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { PositionStat, PositionStatsResponse } from "../../../lib/stats/types";

const POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"] as const;

type Metric = "accuracy" | "avgEVLoss";

interface CellData {
  accuracy: number;
  avgEVLoss: number;
  hands: number;
  confidence: boolean;
}

/**
 * Map accuracy (0-100) to a background color class.
 * Red (weak) -> Yellow (average) -> Green (strong)
 */
function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return "bg-green-600";
  if (accuracy >= 70) return "bg-green-700/70";
  if (accuracy >= 60) return "bg-yellow-600/70";
  if (accuracy >= 50) return "bg-yellow-700/60";
  if (accuracy >= 40) return "bg-orange-600/60";
  return "bg-red-600/70";
}

/**
 * Map avgEVLoss to a background color class.
 * Lower EV loss = better (green), higher = worse (red).
 */
function getEVLossColor(avgEVLoss: number): string {
  if (avgEVLoss <= 0.02) return "bg-green-600";
  if (avgEVLoss <= 0.05) return "bg-green-700/70";
  if (avgEVLoss <= 0.1) return "bg-yellow-600/70";
  if (avgEVLoss <= 0.2) return "bg-yellow-700/60";
  if (avgEVLoss <= 0.4) return "bg-orange-600/60";
  return "bg-red-600/70";
}

function buildGrid(stats: PositionStat[]): Map<string, CellData> {
  const grid = new Map<string, CellData>();
  for (const stat of stats) {
    if (stat.villainPosition === null) continue;
    const key = `${stat.heroPosition}-${stat.villainPosition}`;
    grid.set(key, {
      accuracy: stat.accuracy,
      avgEVLoss: stat.avgEVLoss,
      hands: stat.hands,
      confidence: stat.confidence,
    });
  }
  return grid;
}

export default function PositionHeatmap() {
  const searchParams = useSearchParams();
  const [grid, setGrid] = useState<Map<string, CellData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("accuracy");

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("access_token");
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

        setGrid(buildGrid(data.stats));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load position stats");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Position Heatmap</h2>
        <div className="flex gap-1 rounded-md bg-slate-800 p-0.5">
          <button
            onClick={() => setMetric("accuracy")}
            className={clsx(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              metric === "accuracy"
                ? "bg-slate-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Accuracy %
          </button>
          <button
            onClick={() => setMetric("avgEVLoss")}
            className={clsx(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              metric === "avgEVLoss"
                ? "bg-slate-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Avg EV Loss
          </button>
        </div>
      </div>

      {loading && (
        <p className="py-8 text-center text-sm text-slate-400">Loading position data...</p>
      )}

      {error && (
        <p className="rounded border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          {/* Axis label */}
          <p className="mb-2 text-center text-xs text-slate-500">
            Villain Position (columns) vs Hero Position (rows)
          </p>

          <div className="inline-block">
            {/* Column headers */}
            <div className="flex">
              <div className="w-12 shrink-0" />
              {POSITIONS.map((pos) => (
                <div
                  key={pos}
                  className="flex w-16 shrink-0 items-center justify-center text-xs font-medium text-slate-400"
                >
                  {pos}
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {POSITIONS.map((heroPos) => (
              <div key={heroPos} className="flex">
                {/* Row header */}
                <div className="flex w-12 shrink-0 items-center justify-center text-xs font-medium text-slate-400">
                  {heroPos}
                </div>

                {/* Cells */}
                {POSITIONS.map((villainPos) => {
                  const key = `${heroPos}-${villainPos}`;
                  const cell = grid.get(key);

                  if (heroPos === villainPos) {
                    // Diagonal: same position, no matchup
                    return (
                      <div
                        key={key}
                        className="m-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded bg-slate-800/30"
                      >
                        <span className="text-xs text-slate-600">--</span>
                      </div>
                    );
                  }

                  if (!cell) {
                    return (
                      <div
                        key={key}
                        className="m-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded bg-slate-800"
                      >
                        <span className="text-xs text-slate-600">--</span>
                      </div>
                    );
                  }

                  const colorClass =
                    metric === "accuracy"
                      ? getAccuracyColor(cell.accuracy)
                      : getEVLossColor(cell.avgEVLoss);

                  const displayValue =
                    metric === "accuracy"
                      ? `${cell.accuracy.toFixed(0)}%`
                      : cell.avgEVLoss.toFixed(2);

                  return (
                    <div
                      key={key}
                      className={clsx(
                        "m-0.5 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded text-white",
                        colorClass,
                        !cell.confidence && "opacity-50"
                      )}
                      title={`${heroPos} vs ${villainPos}: ${cell.hands} hands, ${cell.accuracy.toFixed(1)}% accuracy, ${cell.avgEVLoss.toFixed(3)} BB avg EV loss`}
                    >
                      <span className="text-xs font-semibold leading-tight">
                        {displayValue}
                        {!cell.confidence && "*"}
                      </span>
                      <span className="text-[10px] leading-tight text-white/60">
                        {cell.hands}h
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-green-600" /> Strong
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-yellow-600/70" /> Average
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-red-600/70" /> Weak
            </span>
            <span>* Low confidence (&lt;20 hands)</span>
          </div>
        </div>
      )}
    </section>
  );
}
