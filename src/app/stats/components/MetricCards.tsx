"use client";

/**
 * Overview: Hero metric cards displaying key performance stats with trend indicators.
 * Interacts with: /api/stats/performance endpoint, URL search params for date filtering.
 * Importance: Provides at-a-glance performance overview with period-over-period trends.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PerformanceDataPoint } from "@/lib/stats/types";

interface MetricData {
  totalHands: number;
  accuracy: number;
  avgEVLoss: number;
  currentStreak: number;
  trends: {
    hands: number | null;
    accuracy: number | null;
    avgEVLoss: number | null;
    streak: number | null;
  };
}

function computeMetrics(metrics: PerformanceDataPoint[]): MetricData {
  if (metrics.length === 0) {
    return {
      totalHands: 0,
      accuracy: 0,
      avgEVLoss: 0,
      currentStreak: 0,
      trends: { hands: null, accuracy: null, avgEVLoss: null, streak: null },
    };
  }

  const totalHands = metrics.reduce((sum, m) => sum + m.hands, 0);
  const totalCorrect = metrics.reduce((sum, m) => sum + (m.hands * m.accuracy) / 100, 0);
  const accuracy = totalHands > 0 ? totalCorrect / totalHands * 100 : 0;
  const avgEVLoss = totalHands > 0
    ? metrics.reduce((sum, m) => sum + m.avgEVLoss * m.hands, 0) / totalHands
    : 0;

  // Current streak: count consecutive days with accuracy >= 60% from the end
  let currentStreak = 0;
  for (let i = metrics.length - 1; i >= 0; i--) {
    if (metrics[i].accuracy >= 60) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Compute trends by comparing first half vs second half of period
  const mid = Math.floor(metrics.length / 2);
  let trends: MetricData["trends"] = { hands: null, accuracy: null, avgEVLoss: null, streak: null };

  if (metrics.length >= 2) {
    const firstHalf = metrics.slice(0, mid);
    const secondHalf = metrics.slice(mid);

    const firstHands = firstHalf.reduce((s, m) => s + m.hands, 0);
    const secondHands = secondHalf.reduce((s, m) => s + m.hands, 0);

    const firstAcc = firstHands > 0
      ? firstHalf.reduce((s, m) => s + m.accuracy * m.hands, 0) / firstHands
      : 0;
    const secondAcc = secondHands > 0
      ? secondHalf.reduce((s, m) => s + m.accuracy * m.hands, 0) / secondHands
      : 0;

    const firstEV = firstHands > 0
      ? firstHalf.reduce((s, m) => s + m.avgEVLoss * m.hands, 0) / firstHands
      : 0;
    const secondEV = secondHands > 0
      ? secondHalf.reduce((s, m) => s + m.avgEVLoss * m.hands, 0) / secondHands
      : 0;

    trends = {
      hands: firstHands > 0 ? ((secondHands - firstHands) / firstHands) * 100 : null,
      accuracy: firstAcc > 0 ? secondAcc - firstAcc : null,
      avgEVLoss: firstEV > 0 ? ((secondEV - firstEV) / firstEV) * 100 : null,
      streak: null,
    };
  }

  return { totalHands, accuracy, avgEVLoss, currentStreak, trends };
}

interface TrendProps {
  value: number | null;
  /** If true, a negative trend is "good" (e.g., EV loss going down). */
  invertColor?: boolean;
  suffix?: string;
}

function TrendIndicator({ value, invertColor = false, suffix = "%" }: TrendProps) {
  if (value === null || !isFinite(value)) return null;

  const isPositive = value > 0;
  const isGood = invertColor ? !isPositive : isPositive;
  const arrow = isPositive ? "\u25B2" : "\u25BC"; // ▲ or ▼

  return (
    <span
      className={`mt-1 flex items-center gap-1 text-xs font-medium ${
        isGood ? "text-green-400" : "text-red-400"
      }`}
    >
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

interface CardProps {
  label: string;
  value: string;
  trend: number | null;
  invertColor?: boolean;
  trendSuffix?: string;
}

function MetricCard({ label, value, trend, invertColor, trendSuffix }: CardProps) {
  return (
    <article className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-100">{value}</p>
      <TrendIndicator value={trend} invertColor={invertColor} suffix={trendSuffix} />
    </article>
  );
}

export function MetricCards() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchMetrics() {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("access_token");
        const params = new URLSearchParams();

        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/stats/performance?${params.toString()}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch stats (${res.status})`);
        }

        const payload = (await res.json()) as { metrics: PerformanceDataPoint[] };
        if (!mounted) return;

        setData(computeMetrics(payload.metrics));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load metrics");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void fetchMetrics();
    return () => { mounted = false; };
  }, [searchParams]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-700 bg-slate-900 p-5">
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-slate-800" />
            <div className="mb-2 h-9 w-20 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data || data.totalHands === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6 text-center">
        <p className="text-sm text-slate-400">
          No training data yet. Complete some sessions to see your stats.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Hands"
        value={data.totalHands.toLocaleString()}
        trend={data.trends.hands}
      />
      <MetricCard
        label="Accuracy"
        value={`${data.accuracy.toFixed(1)}%`}
        trend={data.trends.accuracy}
        trendSuffix="pp"
      />
      <MetricCard
        label="Avg EV Loss"
        value={`${data.avgEVLoss.toFixed(2)} BB`}
        trend={data.trends.avgEVLoss}
        invertColor
      />
      <MetricCard
        label="Current Streak"
        value={`${data.currentStreak} day${data.currentStreak !== 1 ? "s" : ""}`}
        trend={data.trends.streak}
      />
    </div>
  );
}
