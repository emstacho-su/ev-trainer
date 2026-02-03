"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ActionInput from "../../../components/ActionInput";
import PracticeRecordedStatus from "../../../components/PracticeRecordedStatus";
import SpotView from "../../../components/SpotView";
import TrainingFeedbackPanel from "../../../components/TrainingFeedbackPanel";
import type { Spot } from "../../../lib/engine/spot";
import type { ActionId } from "../../../lib/engine/types";
import type {
  SessionDetailResponse,
  SessionSnapshot,
  SubmitTrainingResponse,
} from "../../../lib/v2/api/sessionHandlers";
import {
  SessionApiError,
  getSession,
  nextDecision,
  submitAction,
} from "../../../lib/v2/api-client/sessionClient";
import {
  deleteSessionRecord,
  readSessionRecord,
  updateSessionRecord,
  updateFromSessionDetail,
} from "../../../lib/v2/storage/sessionStorage";

function toSummaryHref(detail: SessionDetailResponse): string {
  return `/summary/${detail.session.sessionId}?seed=${encodeURIComponent(
    detail.session.seed
  )}&mode=${detail.session.mode}&reviewAvailable=${detail.reviewAvailable ? "1" : "0"}`;
}

export default function SessionPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const sessionId = useMemo(
    () => (typeof params.id === "string" ? params.id : ""),
    [params.id]
  );

  const [seed, setSeed] = useState<string | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [currentSpot, setCurrentSpot] = useState<Spot | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<ActionId>("CHECK");
  const [trainingFeedback, setTrainingFeedback] =
    useState<SubmitTrainingResponse | null>(null);
  const [practiceRecorded, setPracticeRecorded] = useState(false);
  const [mobileFeedbackOpen, setMobileFeedbackOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  const loadSession = useCallback(
    async (sessionSeed: string) => {
      const detail = await getSession(sessionId, sessionSeed);
      updateFromSessionDetail(detail);
      setSession(detail.session);
      if (detail.session.isComplete) {
        router.replace(toSummaryHref(detail));
      }
      return detail;
    },
    [router, sessionId]
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setIsLoading(true);
      setErrorMessage(null);

      const stored = readSessionRecord(sessionId);
      const paramSeed = searchParams.get("seed");
      const resolvedSeed = paramSeed ?? stored?.session.seed ?? null;

      if (!mounted) return;
      setSeed(resolvedSeed);

      if (!resolvedSeed) {
        setErrorMessage("Missing seed for this session. Delete it from recent sessions.");
        setSession(stored?.session ?? null);
        setCurrentSpot(stored?.currentSpot ?? null);
        setIsLoading(false);
        return;
      }

      setSession(stored?.session ?? null);
      setCurrentSpot(stored?.currentSpot ?? null);

      try {
        const detail = await loadSession(resolvedSeed);
        if (!mounted) return;
        if (!stored?.currentSpot && !detail.session.isComplete) {
          setErrorMessage("Session loaded but no saved spot is available to submit.");
        }
      } catch (error) {
        if (!mounted) return;
        if (error instanceof SessionApiError) {
          setErrorMessage(`${error.code}: ${error.message}`);
        } else {
          setErrorMessage("Failed to load session.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    if (sessionId) {
      void bootstrap();
    } else {
      setIsLoading(false);
      setErrorMessage("Invalid session id.");
    }

    return () => {
      mounted = false;
    };
  }, [loadSession, searchParams, sessionId]);

  const handleSubmit = useCallback(async () => {
    if (!seed || !session || !currentSpot) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await submitAction({
        seed,
        sessionId: session.sessionId,
        spot: currentSpot,
        actionId: selectedActionId,
      });
      if (session.mode === "TRAINING" && "result" in response) {
        setTrainingFeedback(response);
        setPracticeRecorded(false);
        setMobileFeedbackOpen(true);
      } else {
        setTrainingFeedback(null);
        setPracticeRecorded(true);
      }

      updateSessionRecord(session.sessionId, (previous) => ({
        session,
        currentSpot,
        reviewAvailable: session.mode === "TRAINING",
        lastSubmit: response,
        startedAt: previous?.startedAt,
        completedAt: previous?.completedAt,
        aggregates: previous?.aggregates,
      }));
    } catch (error) {
      if (error instanceof SessionApiError) {
        setErrorMessage(`${error.code}: ${error.message}`);
      } else {
        setErrorMessage("Failed to submit action.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [currentSpot, seed, selectedActionId, session]);

  const handleNext = useCallback(async () => {
    if (!seed || !session) return;
    setIsLoadingNext(true);
    setErrorMessage(null);
    try {
      const response = await nextDecision({
        seed,
        sessionId: session.sessionId,
      });
      setSession(response.session);
      setCurrentSpot(response.spot);
      setTrainingFeedback(null);
      setPracticeRecorded(false);
      setMobileFeedbackOpen(false);
      setSelectedActionId("CHECK");
      updateSessionRecord(response.session.sessionId, (previous) => ({
        session: response.session,
        currentSpot: response.spot,
        reviewAvailable: response.session.mode === "TRAINING",
        lastSubmit: previous?.lastSubmit,
        startedAt: previous?.startedAt,
        completedAt:
          response.session.isComplete && !previous?.completedAt
            ? new Date().toISOString()
            : previous?.completedAt,
        aggregates: previous?.aggregates,
      }));
      if (response.session.isComplete) {
        router.replace(
          `/summary/${response.session.sessionId}?seed=${encodeURIComponent(
            response.session.seed
          )}&mode=${response.session.mode}&reviewAvailable=${
            response.session.mode === "TRAINING" ? "1" : "0"
          }`
        );
      }
    } catch (error) {
      if (error instanceof SessionApiError && error.code === "SESSION_COMPLETE") {
        try {
          const detail = await loadSession(seed);
          router.replace(toSummaryHref(detail));
        } catch {
          router.replace(`/summary/${session.sessionId}?mode=${session.mode}`);
        }
      } else if (error instanceof SessionApiError) {
        setErrorMessage(`${error.code}: ${error.message}`);
      } else {
        setErrorMessage("Failed to load next decision.");
      }
    } finally {
      setIsLoadingNext(false);
    }
  }, [loadSession, router, seed, session]);

  const showDeleteMissingSeed =
    !seed && !isLoading && errorMessage?.includes("Missing seed") === true;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="text-sm underline">
          Back home
        </Link>
        {session ? (
          <p className="text-sm text-stone-600">
            {session.mode} · {session.decisionIndex}/{session.decisionsPerSession}
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {showDeleteMissingSeed ? (
        <button
          type="button"
          onClick={() => {
            deleteSessionRecord(sessionId);
            router.push("/");
          }}
          className="rounded border border-stone-400 px-3 py-2 text-sm"
        >
          Delete this session
        </button>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-stone-600">Loading session...</p>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex-1 space-y-4">
            <SpotView spot={currentSpot} />
            <ActionInput
              selectedActionId={selectedActionId}
              onSelect={setSelectedActionId}
              onSubmit={handleSubmit}
              onNext={handleNext}
              canSubmit={Boolean(session && currentSpot) && !isSubmitting && !isLoadingNext}
              canNext={Boolean(session && seed) && !isSubmitting && !isLoadingNext}
              isSubmitting={isSubmitting}
              isLoadingNext={isLoadingNext}
            />
            {session?.mode === "PRACTICE" ? (
              <PracticeRecordedStatus visible={practiceRecorded} />
            ) : null}
          </div>
          {session?.mode === "TRAINING" ? (
            <TrainingFeedbackPanel
              response={trainingFeedback}
              mobileOpen={mobileFeedbackOpen}
              onCloseMobile={() => setMobileFeedbackOpen(false)}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}
