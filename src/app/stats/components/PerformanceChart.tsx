"use client";

/**
 * Overview: Interactive line chart showing performance metrics over time using Recharts.
 * Interacts with: /api/stats/performance endpoint, URL search params for date filtering.
 * Importance: Core visualization for the Performance tab on the stats dashboard.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { PerformanceDataPoint } from "@/lib/stats/types";

type MetricKey =
  | "avgEVLoss"
  | "accuracy"
  | "hands"
  | "correctFoldPct"
  | "correctRaisePct";

interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  unit: string;
  format: (v: number) => string;
}

const METRICS: MetricConfig[] = [
  {
    key: "avgEVLoss",
    label: "Avg EV Loss",
    color: "#4ade80", // green-400
    unit: "BB",
    format: (v) => v.toFixed(2),
  },
  {
    key: "accuracy",
    label: "Accuracy",
    color: "#60a5fa", // blue-400
    unit: "%",
    format: (v) => v.toFixed(1),
  },
  {
    key: "hands",
    label: "Hands Played",
    color: "#c084fc", // purple-400
    unit: "",
    format: (v) => String(Math.round(v)),
  },
  {
    key: "correctFoldPct",
    label: "Correct Fold %",
    color: "#facc15", // yellow-400
    unit: "%",
    format: (v) => v.toFixed(1),
  },
  {
    key: "correctRaisePct",
    label: "Correct Raise %",
    color: "#fb923c", // orange-400
    unit: "%",
    format: (v) => v.toFixed(1),
  },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: PerformanceDataPoint;
  }>;
  label?: string;
  metricConfig: MetricConfig;
}

function CustomTooltip({ active, payload, metricConfig }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  const value = payload[0].value;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-slate-300">
        {format(parseISO(point.date), "MMM d, yyyy")}
      </p>
      <p className="mt-1 text-sm font-bold" style={{ color: metricConfig.color }}>
        {metricConfig.format(value)} {metricConfig.unit}
      </p>
      <div className="mt-1 flex gap-3 text-xs text-slate-400">
        <span>{point.hands} hands</span>
        <span>{point.sessionCount} session{point.sessionCount !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

export default function PerformanceChart() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PerformanceDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("avgEVLoss");

  const metricConfig = METRICS.find((m) => m.key === selectedMetric)!;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
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

      const res = await fetch(`/api/stats/performance?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch performance data (${res.status})`);
      }

      const payload = (await res.json()) as { metrics: PerformanceDataPoint[] };
      setData(payload.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chart data");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
        <div className="text-sm text-slate-400">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
        <p className="text-sm text-slate-400">No performance data yet.</p>
        <p className="mt-1 text-xs text-slate-500">
          Complete some training sessions to see your progress.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
      {/* Header with metric selector */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Performance Over Time</h3>
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-blue-500"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value: string) => {
              try {
                return format(parseISO(value), "MMM d");
              } catch {
                return value;
              }
            }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value: number) => metricConfig.format(value)}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            content={<CustomTooltip metricConfig={metricConfig} />}
            cursor={{ stroke: "#475569", strokeDasharray: "3 3" }}
          />
          <Line
            type="monotone"
            dataKey={selectedMetric}
            stroke={metricConfig.color}
            strokeWidth={2}
            dot={{ r: 3, fill: metricConfig.color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: metricConfig.color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
