"use client";

/**
 * Overview: Skeleton loading components for the stats dashboard.
 * Interacts with: Suspense boundaries in stats page layout.
 * Importance: Reduces perceived loading time with layout-matched placeholders.
 */

import { Fragment } from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse rounded bg-slate-800", className)}
      style={style}
    />
  );
}

/** Skeleton for a single metric card (matches MetricCards dimensions). */
export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      {/* Label */}
      <Skeleton className="mb-3 h-4 w-24" />
      {/* Value */}
      <Skeleton className="mb-2 h-9 w-20" />
      {/* Trend */}
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/** Grid of 4 metric card skeletons matching the hero metrics layout. */
export function MetricCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </div>
  );
}

/** Skeleton for a chart area (line/bar chart). */
export function ChartSkeleton() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      {/* Chart title */}
      <Skeleton className="mb-4 h-5 w-40" />
      {/* Chart area */}
      <div className="flex items-end gap-2" style={{ height: 240 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
      {/* X-axis labels */}
      <div className="mt-3 flex justify-between">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/** Skeleton for a data table with rows. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      {/* Table header */}
      <div className="mb-4 flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 border-t border-slate-800 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the position heatmap grid. */
export function HeatmapSkeleton() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      {/* Title */}
      <Skeleton className="mb-4 h-5 w-48" />
      {/* 6x6 grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Header row */}
        <div />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-6 w-full" />
        ))}
        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, row) => (
          <Fragment key={row}>
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, col) => (
              <Skeleton key={`c-${row}-${col}`} className="h-10 w-full" />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Full dashboard skeleton combining all sections. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <MetricCardsSkeleton />
      <ChartSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <HeatmapSkeleton />
        <TableSkeleton />
      </div>
    </div>
  );
}
