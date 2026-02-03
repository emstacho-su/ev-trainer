"use client";

/**
 * Overview: End-of-session summary with aggregates and review entry point.
 * Interacts with: session detail API, aggregate calculators, persisted session records.
 * Importance: Converts completed session data into actionable EV-focused outcomes.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import SummaryStatsCards from "../../../components/SummaryStatsCards";
import { computeSessionAggregates } from "../../../lib/aggregates/sessionAggregates";
import { getSession } from "../../../lib/v2/api-client/sessionClient";
import type { SessionDetailResponse } from "../../../lib/v2/api/sessionHandlers";
import type {
  PersistedSessionAggregates,
  PersistedSessionRecord,
} from "../../../lib/v2/storage/sessionStorage";
import {
  readSessionRecord,
  updateSessionRecord,
  updateFromSessionDetail,
} from "../../../lib/v2/storage/sessionStorage";

export default function SummaryPlaceholderPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const sessionId = useMemo(
    () => (typeof params.id === "string" ? params.id : ""),
    [params.id]
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [aggregates, setAggregates] = useState<PersistedSessionAggregates | null>(
    null
  );

  function resolveDurationMs(record: PersistedSessionRecord | null): number {
    if (!record?.startedAt || !record.completedAt) return 0;
    const startedAtMs = Date.parse(record.startedAt);
    const completedAtMs = Date.parse(record.completedAt);
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs)) return 0;
    return Math.max(0, completedAtMs - startedAtMs);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!sessionId) {
        setErrorMessage("Invalid session id.");
        setLoading(false);
        return;
      }
      const stored = readSessionRecord(sessionId);
      const resolvedSeed = searchParams.get("seed") ?? stored?.session.seed ?? null;
      setSeed(resolvedSeed);
      if (!resolvedSeed) {
        setErrorMessage("Missing seed for this session.");
        setLoading(false);
        return;
      }

      try {
        const response = await getSession(sessionId, resolvedSeed);
        if (!mounted) return;
        setDetail(response);
        updateFromSessionDetail(response);
        const refreshed = readSessionRecord(sessionId);
        if (refreshed?.aggregates) {
          setAggregates(refreshed.aggregates);
          return;
        }

        if (!response.session.isComplete) {
          setAggregates(null);
          return;
        }

        const computed = computeSessionAggregates(response.entries ?? []);
        const completedAt = refreshed?.completedAt ?? new Date().toISOString();
        const startedAt = refreshed?.startedAt;
        const durationMs =
          startedAt && Number.isFinite(Date.parse(startedAt))
            ? Math.max(0, Date.parse(completedAt) - Date.parse(startedAt))
            : 0;
        const nextAggregates: PersistedSessionAggregates = {
          volume: computed.volume,
          meanEvLoss: computed.meanEvLoss,
          bestActionRate: computed.bestActionRate,
          durationMs,
        };
        updateSessionRecord(sessionId, (previous) => {
          if (!previous) return null;
          return {
            ...previous,
            completedAt: previous.completedAt ?? completedAt,
            aggregates: nextAggregates,
          };
        });
        setAggregates(nextAggregates);
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Failed to load summary.";
        setErrorMessage(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [searchParams, sessionId]);

  const reviewEnabled = Boolean(detail?.session.isComplete && detail.reviewAvailable && seed);
  const mode = detail?.session.mode ?? searchParams.get("mode") ?? "UNKNOWN";
  const safeAggregates =
    aggregates ??
    (detail?.session.isComplete
      ? {
          volume: 0,
          meanEvLoss: 0,
          bestActionRate: 0,
          durationMs: resolveDurationMs(readSessionRecord(sessionId)),
        }
      : null);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <Link href="/" className="text-sm underline">
        Back home
      </Link>
      <h1 className="text-2xl font-semibold">Session Summary</h1>
      <p className="text-sm text-stone-600">
        sessionId: <span className="font-mono">{sessionId || "unknown"}</span>
      </p>
      <p className="text-sm text-stone-600">mode: {mode}</p>
      {loading ? <p className="text-sm text-stone-600">Loading summary...</p> : null}
      {errorMessage ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {detail && !detail.session.isComplete ? (
        <section className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Session not complete yet. Finish all decisions to unlock summary review.
        </section>
      ) : null}

      {safeAggregates ? <SummaryStatsCards aggregates={safeAggregates} /> : null}

      <button
        type="button"
        disabled={!reviewEnabled}
        onClick={() => {
          if (!seed) return;
          router.push(`/review/${sessionId}?seed=${encodeURIComponent(seed)}`);
        }}
        className="rounded bg-stone-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Review session
      </button>
    </main>
  );
}
