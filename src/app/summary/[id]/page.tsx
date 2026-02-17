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

        // Fallback to localStorage data when API fails
        const localRecord = readSessionRecord(sessionId);
        if (localRecord) {
          // Build a detail-like object from localStorage if session is complete
          if (localRecord.session.isComplete || localRecord.aggregates) {
            setDetail({
              ok: true,
              session: localRecord.session,
              reviewAvailable: localRecord.reviewAvailable ?? false,
              entries: [],
            } as SessionDetailResponse);

            if (localRecord.aggregates) {
              setAggregates(localRecord.aggregates);
            } else {
              // Provide basic aggregates from what we have
              const durationMs = resolveDurationMs(localRecord);
              setAggregates({
                volume: localRecord.session.decisionsPerSession,
                meanEvLoss: 0,
                bestActionRate: 0,
                durationMs,
              });
            }
            return;
          }
        }

        // No localStorage fallback available -- show user-friendly error
        const apiError = error as { status?: number; code?: string };
        let message: string;
        if (apiError.status === 404 && apiError.code === "SESSION_EXPIRED") {
          message =
            "This session has expired. Guest sessions are temporary. Sign up to save your progress.";
        } else if (apiError.status === 500) {
          message =
            "Something went wrong loading your session. Try refreshing the page.";
        } else {
          message =
            error instanceof Error ? error.message : "Failed to load summary.";
        }
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
      <Link href="/" className="text-sm text-gray-400 underline hover:text-gray-200">
        Back to dashboard
      </Link>
      <h1 className="text-2xl font-semibold text-gray-100">Session Summary</h1>
      <p className="text-sm text-gray-400">
        sessionId: <span className="font-mono">{sessionId || "unknown"}</span>
      </p>
      <p className="text-sm text-gray-400">mode: {mode}</p>
      {loading ? <p className="text-sm text-gray-400">Loading summary...</p> : null}
      {errorMessage ? (
        <p className="rounded border border-red-500/50 bg-red-900/30 p-3 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      {detail && !detail.session.isComplete ? (
        <section className="rounded border border-amber-500/50 bg-amber-900/30 p-3 text-sm text-amber-200">
          Session not complete yet. Finish all decisions to unlock summary review.
        </section>
      ) : null}

      {safeAggregates ? <SummaryStatsCards aggregates={safeAggregates} /> : null}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={!reviewEnabled}
          onClick={() => {
            if (!seed) return;
            router.push(`/review/${sessionId}?seed=${encodeURIComponent(seed)}`);
          }}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review session
        </button>
        <Link
          href="/training"
          className="rounded border border-gray-600 px-4 py-2 text-gray-300 hover:bg-gray-800"
        >
          New session
        </Link>
      </div>
    </main>
  );
}
