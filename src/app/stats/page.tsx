"use client";

/**
 * Overview: Stats dashboard page with hero metrics, filter bar, and tabbed sections.
 * Interacts with: MetricCards, FilterBar, LoadingSkeletons, PositionHeatmap, WeaknessBreakdown, SessionHistory.
 * Importance: Central performance overview for authenticated users.
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { MetricCards } from "./components/MetricCards";
import { FilterBar } from "./components/FilterBar";
import { MetricCardsSkeleton, ChartSkeleton, HeatmapSkeleton, TableSkeleton } from "./components/LoadingSkeletons";
import PositionHeatmap from "./components/PositionHeatmap";
import WeaknessBreakdown from "./components/WeaknessBreakdown";
import SessionHistory from "./components/SessionHistory";
import FlaggedHandsList from "./components/FlaggedHandsList";
import PerformanceChart from "./components/PerformanceChart";

type Tab = "performance" | "positions" | "sessions" | "flagged";

const TABS: { id: Tab; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "positions", label: "Positions" },
  { id: "sessions", label: "Sessions" },
  { id: "flagged", label: "Flagged" },
];

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("performance");

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Performance Statistics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track your training progress and identify areas for improvement.
          </p>
        </div>
        <Link
          href="/lobby"
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
        >
          Back to Lobby
        </Link>
      </div>

      {/* Filter Bar */}
      <Suspense fallback={null}>
        <FilterBar />
      </Suspense>

      {/* Hero Metric Cards */}
      <Suspense fallback={<MetricCardsSkeleton />}>
        <MetricCards />
      </Suspense>

      {/* Tabbed Sections */}
      <div className="space-y-4">
        <nav className="flex gap-1 border-b border-slate-700">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Performance tab */}
        {activeTab === "performance" && (
          <Suspense fallback={<ChartSkeleton />}>
            <PerformanceChart />
          </Suspense>
        )}

        {/* Positions tab */}
        {activeTab === "positions" && (
          <Suspense fallback={<HeatmapSkeleton />}>
            <div className="space-y-6">
              <PositionHeatmap />
              <WeaknessBreakdown />
            </div>
          </Suspense>
        )}

        {/* Sessions tab */}
        {activeTab === "sessions" && (
          <Suspense fallback={<TableSkeleton rows={10} />}>
            <SessionHistory />
          </Suspense>
        )}

        {/* Flagged tab */}
        {activeTab === "flagged" && (
          <Suspense fallback={<TableSkeleton rows={5} />}>
            <FlaggedHandsList />
          </Suspense>
        )}
      </div>
    </main>
  );
}
