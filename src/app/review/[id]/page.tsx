"use client";

/**
 * Overview: Session review surface with decision list and detailed drilldown.
 * Interacts with: session detail API, review list/detail components, stored seed/session metadata.
 * Importance: Enables post-session mistake analysis once review is unlocked.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import ReviewDecisionDetail from "../../../components/ReviewDecisionDetail";
import ReviewDecisionList from "../../../components/ReviewDecisionList";
import type { SessionDetailResponse } from "../../../lib/v2/api/sessionHandlers";
import { getSession } from "../../../lib/v2/api-client/sessionClient";
import { readSessionRecord } from "../../../lib/v2/storage/sessionStorage";

export default function ReviewPage() {
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const sessionId = useMemo(
    () => (typeof params.id === "string" ? params.id : ""),
    [params.id]
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!sessionId) {
        setErrorMessage("Invalid session id.");
        setLoading(false);
        return;
      }
      const stored = readSessionRecord(sessionId);
      const seed = searchParams.get("seed") ?? stored?.session.seed ?? null;
      if (!seed) {
        setErrorMessage("Missing seed for this review.");
        setLoading(false);
        return;
      }

      try {
        const response = await getSession(sessionId, seed);
        if (!mounted) return;
        setDetail(response);
        if (!response.session.isComplete || !response.reviewAvailable) {
          setBlockedMessage(
            "Review is locked until this session is complete. Return to session to finish all decisions."
          );
          return;
        }
        setBlockedMessage(null);
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Failed to load review.";
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

  const entries = detail?.entries ?? [];
  const selectedEntry = entries[selectedEntryIndex] ?? null;

  return (
    <main className="app-page mx-auto max-w-6xl space-y-4 p-6">
      <Link href="/" className="link-subtle text-sm">
        Back home
      </Link>
      <h1 className="text-2xl font-semibold">Session Review</h1>
      <p className="text-muted text-sm">
        sessionId: <span className="font-mono">{sessionId || "unknown"}</span>
      </p>

      {loading ? <p className="text-muted text-sm">Loading review...</p> : null}
      {errorMessage ? (
        <p className="alert-error text-sm">
          {errorMessage}
        </p>
      ) : null}
      {blockedMessage ? (
        <p className="alert-warning text-sm">
          {blockedMessage}
        </p>
      ) : null}

      {!loading && !errorMessage && !blockedMessage ? (
        entries.length === 0 ? (
          <p className="surface-card text-muted p-3 text-sm">
            No review entries found for this session.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <ReviewDecisionList
              entries={entries}
              selectedIndex={selectedEntryIndex}
              onSelect={setSelectedEntryIndex}
            />
            <ReviewDecisionDetail entry={selectedEntry} />
          </div>
        )
      ) : null}
    </main>
  );
}
