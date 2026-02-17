"use client";

/**
 * Overview: Global stats dashboard for completed persisted sessions.
 * Interacts with: local records extraction, /api/stats endpoint, breakdown rendering tables.
 * Importance: Gives cross-session EV trend visibility and practice prioritization context.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import type { GlobalStatsResult } from "../../lib/aggregates/globalStats";
import { createZeroGlobalStats } from "../../lib/aggregates/globalStats";
import { readSessionIndex, readSessionRecord } from "../../lib/v2/storage/sessionStorage";
import PositionHeatmap from "./components/PositionHeatmap";
import WeaknessBreakdown from "./components/WeaknessBreakdown";
import SessionHistory from "./components/SessionHistory";

type Tab = "performance" | "positions" | "sessions";

const TABS: { id: Tab; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "positions", label: "Positions" },
  { id: "sessions", label: "Sessions" },
];

const SESSIONS_HEADER = "x-ev-trainer-sessions";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function encodeRecords(records: unknown[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(records));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function readPersistedSessions(): { records: unknown[]; hadUnreadableRecords: boolean } {
  const index = readSessionIndex();
  let hadUnreadableRecords = false;
  const records: unknown[] = [];
  for (const item of index) {
    const record = readSessionRecord(item.sessionId);
    if (!record) {
      hadUnreadableRecords = true;
      continue;
    }
    records.push(record);
  }
  return { records, hadUnreadableRecords };
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: GlobalStatsResult["breakdowns"]["byStreet"];
}) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No data.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2">Bucket</th>
                <th className="pb-2">Decisions</th>
                <th className="pb-2">Mean EV Loss</th>
                <th className="pb-2">Best-Action Rate</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {rows.map((row) => (
                <tr key={row.bucket} className="border-t border-slate-800">
                  <td className="py-2">{row.bucket}</td>
                  <td className="py-2">{row.decisions}</td>
                  <td className="py-2">{row.meanEvLoss.toFixed(3)}</td>
                  <td className="py-2">{formatPercent(row.bestActionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<GlobalStatsResult>(createZeroGlobalStats);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("performance");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { records, hadUnreadableRecords } = readPersistedSessions();
        if (hadUnreadableRecords) {
          setWarning("Some stored sessions could not be read and were skipped.");
        }

        const response = await fetch("/api/stats", {
          method: "GET",
          headers: { [SESSIONS_HEADER]: encodeRecords(records) },
          cache: "no-store",
        });
        const payload = (await response.json()) as GlobalStatsResult & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load stats.");
        }
        if (!mounted) return;
        setStats(payload);
      } catch (err) {
        if (!mounted) return;
        setStats(createZeroGlobalStats());
        const message = err instanceof Error ? err.message : "Failed to load stats.";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <Link href="/" className="text-sm text-slate-400 underline hover:text-slate-200">
        Back home
      </Link>
      <h1 className="text-2xl font-semibold text-slate-100">Global Stats</h1>

      {/* Tab navigation */}
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

      {/* Performance tab (existing content) */}
      {activeTab === "performance" && (
        <>
          {loading ? <p className="text-sm text-slate-400">Loading stats...</p> : null}
          {warning ? (
            <p className="rounded border border-amber-700 bg-amber-900/30 p-3 text-sm text-amber-300">
              {warning}
            </p>
          ) : null}
          {error ? (
            <p className="rounded border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Mean EV loss</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">
                {stats.totals.meanEvLoss.toFixed(3)}
              </p>
            </article>
            <article className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Best-action rate</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">
                {formatPercent(stats.totals.bestActionRate)}
              </p>
            </article>
            <article className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500"># Decisions</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">
                {stats.totals.totalDecisions}
              </p>
            </article>
            <article className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500"># Sessions</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">
                {stats.totals.totalSessions}
              </p>
            </article>
          </section>

          {!loading && stats.totals.totalSessions === 0 ? (
            <p className="rounded border border-slate-700 bg-slate-800 p-3 text-sm text-slate-400">
              No completed sessions yet.
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <BreakdownTable title="By Street" rows={stats.breakdowns.byStreet} />
            <BreakdownTable title="By Pot Type" rows={stats.breakdowns.byPotType} />
            <BreakdownTable title="By Stack Bucket" rows={stats.breakdowns.byStackBucket} />
          </div>
        </>
      )}

      {/* Positions tab */}
      {activeTab === "positions" && (
        <div className="space-y-6">
          <PositionHeatmap />
          <WeaknessBreakdown />
        </div>
      )}

      {/* Sessions tab */}
      {activeTab === "sessions" && <SessionHistory />}
    </main>
  );
}
