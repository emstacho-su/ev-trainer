"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import PokerTable from "../../components/PokerTable";
import type { CanonicalNode } from "../../lib/engine/nodeTypes";
import type { SolverActionOutput } from "../../lib/engine/solverAdapter";
import type { SpotCandidate, TargetedDrillFilters } from "../../lib/engine/spotSelection";
import type {
  HandPlayResponse,
  ReviewDetailResponse,
  ReviewListResponse,
  SpotQuizResponse,
  TargetedDrillResponse,
} from "../../lib/engine/trainingApi";

type ActiveMode = "spot-quiz" | "hand-play" | "targeted-drill" | "review";

interface ApiError {
  status: number;
  message: string;
}

const baseNode: CanonicalNode = {
  gameVersion: "g1",
  abstractionVersion: "a1",
  solverVersion: "demo-1",
  publicState: {
    street: "FLOP",
    potBb: 6,
    effectiveStackBb: 100,
    board: ["Ah", "Kd", "7c"],
    toAct: "BTN",
  },
  history: {
    actions: ["CHECK"],
  },
  toAct: "BTN",
  abstraction: {
    betSizesBb: [0.5],
    raiseSizesBb: [1],
    maxRaisesPerStreet: 1,
  },
  rangeContext: "btn-vs-bb",
};

const altNode: CanonicalNode = {
  gameVersion: "g1",
  abstractionVersion: "a1",
  solverVersion: "demo-1",
  publicState: {
    street: "FLOP",
    potBb: 12,
    effectiveStackBb: 100,
    board: ["Qs", "Qd", "4c"],
    toAct: "BB",
  },
  history: {
    actions: ["CHECK", "BET_50PCT"],
  },
  toAct: "BB",
  abstraction: {
    betSizesBb: [0.5],
    raiseSizesBb: [1],
    maxRaisesPerStreet: 1,
  },
  rangeContext: "bb-vs-btn",
};

const targetedCandidates: SpotCandidate[] = [
  { node: baseNode, boardBucket: "rainbow" },
  { node: altNode, boardBucket: "paired" },
];

const targetedFilters: TargetedDrillFilters = {
  streets: ["FLOP"],
  boardBuckets: ["rainbow", "paired"],
  treeRestrictions: {
    maxRaisesPerStreet: 1,
    betSizesBb: [0.5],
    raiseSizesBb: [1],
  },
};

const tableSeatsBySize = {
  "heads-up": [
    { id: "hero", label: "Hero (BTN)" },
    { id: "villain", label: "Villain (BB)" },
  ],
  "6-max": [
    { id: "s1", label: "Hero (BTN)" },
    { id: "s2", label: "SB" },
    { id: "s3", label: "BB" },
    { id: "s4", label: "UTG" },
    { id: "s5", label: "HJ" },
    { id: "s6", label: "CO" },
  ],
  "9-max": [
    { id: "s1", label: "Hero (BTN)" },
    { id: "s2", label: "SB" },
    { id: "s3", label: "BB" },
    { id: "s4", label: "UTG" },
    { id: "s5", label: "UTG+1" },
    { id: "s6", label: "MP" },
    { id: "s7", label: "LJ" },
    { id: "s8", label: "HJ" },
    { id: "s9", label: "CO" },
  ],
} as const;

const tableZones = [
  { id: "pot", label: "Pot" },
  { id: "community", label: "Board" },
  { id: "hero-cards", label: "Hero Cards" },
  { id: "villain-cards", label: "Villain Cards" },
] as const;

const DEFAULT_ACTION_ID = "CHECK";

function formatEv(value: number | undefined): string {
  if (value === undefined) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} bb`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return "--";
  return `${(value * 100).toFixed(0)}%`;
}

function findActionId(
  current: string,
  actions: SolverActionOutput[] | undefined
): string {
  if (actions && actions.some((action) => action.actionId === current)) return current;
  if (actions && actions.length > 0) return actions[0].actionId;
  return current || DEFAULT_ACTION_ID;
}

async function postJson<T>(
  path: string,
  payload: Record<string, unknown>
): Promise<{ data: T } | { error: ApiError }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      typeof (body as { error?: unknown })?.error === "string"
        ? (body as { error: string }).error
        : "Request failed";
    return { error: { status: response.status, message } };
  }

  return { data: body as T };
}

export default function TrainingPreview() {
  const [seed, setSeed] = useState("preview-seed");
  const [sessionId, setSessionId] = useState("preview-session");
  const [activeMode, setActiveMode] = useState<ActiveMode>("spot-quiz");
  const [tableSize, setTableSize] = useState<"heads-up" | "6-max" | "9-max">("6-max");

  const [spotQuizResponse, setSpotQuizResponse] = useState<SpotQuizResponse | null>(
    null
  );
  const [spotQuizActionId, setSpotQuizActionId] = useState(DEFAULT_ACTION_ID);
  const [spotQuizError, setSpotQuizError] = useState<ApiError | null>(null);

  const [handPlayResponse, setHandPlayResponse] = useState<HandPlayResponse | null>(
    null
  );
  const [handPlayActionId, setHandPlayActionId] = useState(DEFAULT_ACTION_ID);
  const [handPlaySequenceIndex, setHandPlaySequenceIndex] = useState(0);
  const [handPlayError, setHandPlayError] = useState<ApiError | null>(null);

  const [targetedResponse, setTargetedResponse] =
    useState<TargetedDrillResponse | null>(null);
  const [targetedActionId, setTargetedActionId] = useState(DEFAULT_ACTION_ID);
  const [targetedSequenceIndex, setTargetedSequenceIndex] = useState(0);
  const [targetedError, setTargetedError] = useState<ApiError | null>(null);

  const [reviewList, setReviewList] = useState<ReviewListResponse | null>(null);
  const [reviewDetail, setReviewDetail] = useState<ReviewDetailResponse | null>(
    null
  );
  const [reviewError, setReviewError] = useState<ApiError | null>(null);
  const [reviewDetailError, setReviewDetailError] = useState<ApiError | null>(null);

  useEffect(() => {
    const actions = spotQuizResponse?.output.actions;
    if (!actions || actions.length === 0) return;
    setSpotQuizActionId((current) => findActionId(current, actions));
  }, [spotQuizResponse]);

  useEffect(() => {
    const actions = handPlayResponse?.output.actions;
    if (!actions || actions.length === 0) return;
    setHandPlayActionId((current) => findActionId(current, actions));
  }, [handPlayResponse]);

  useEffect(() => {
    const actions = targetedResponse?.output?.actions;
    if (!actions || actions.length === 0) return;
    setTargetedActionId((current) => findActionId(current, actions));
  }, [targetedResponse]);

  const spotQuizActions = spotQuizResponse?.output.actions ?? [];
  const handPlayActions = handPlayResponse?.output.actions ?? [];
  const targetedActions = targetedResponse?.output?.actions ?? [];

  const reviewItems = reviewList?.items ?? [];

  const resetSession = () => {
    setSpotQuizResponse(null);
    setSpotQuizError(null);
    setHandPlayResponse(null);
    setHandPlayError(null);
    setTargetedResponse(null);
    setTargetedError(null);
    setReviewList(null);
    setReviewDetail(null);
    setReviewError(null);
    setReviewDetailError(null);
  };

  const submitSpotQuiz = async () => {
    setSpotQuizError(null);
    const result = await postJson<SpotQuizResponse>("/api/training/spot-quiz", {
      seed,
      sessionId,
      node: baseNode,
      userActionId: spotQuizActionId || DEFAULT_ACTION_ID,
    });
    if ("error" in result) {
      setSpotQuizError(result.error);
      return;
    }
    setSpotQuizResponse(result.data);
  };

  const submitHandPlay = async () => {
    setHandPlayError(null);
    const result = await postJson<HandPlayResponse>("/api/training/hand-play", {
      seed,
      sessionId,
      node: baseNode,
      userActionId: handPlayActionId || DEFAULT_ACTION_ID,
      sequenceIndex: Number(handPlaySequenceIndex) || 0,
    });
    if ("error" in result) {
      setHandPlayError(result.error);
      return;
    }
    setHandPlayResponse(result.data);
  };

  const submitTargetedDrill = async () => {
    setTargetedError(null);
    const result = await postJson<TargetedDrillResponse>(
      "/api/training/targeted-drill",
      {
        seed,
        sessionId,
        candidates: targetedCandidates,
        filters: targetedFilters,
        userActionId: targetedActionId || DEFAULT_ACTION_ID,
        sequenceIndex: Number(targetedSequenceIndex) || 0,
      }
    );
    if ("error" in result) {
      setTargetedError(result.error);
      return;
    }
    setTargetedResponse(result.data);
  };

  const submitReviewList = async () => {
    setReviewError(null);
    const result = await postJson<ReviewListResponse>("/api/training/review/list", {
      seed,
      sessionId,
      sort: "evLossVsMixDesc",
    });
    if ("error" in result) {
      setReviewError(result.error);
      return;
    }
    setReviewList(result.data);
  };

  const submitReviewDetail = async (id: string) => {
    setReviewDetailError(null);
    const result = await postJson<ReviewDetailResponse>(
      "/api/training/review/detail",
      {
        seed,
        sessionId,
        id,
      }
    );
    if ("error" in result) {
      setReviewDetailError(result.error);
      return;
    }
    setReviewDetail(result.data);
  };

  const tabButton = (mode: ActiveMode, label: string) => (
    <button
      key={mode}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
        activeMode === mode
          ? "border-stone-900 bg-stone-900 text-white"
          : "border-stone-200 bg-white text-stone-700"
      }`}
      type="button"
      onClick={() => setActiveMode(mode)}
    >
      {label}
    </button>
  );

  const responseCard = (
    title: string,
    error: ApiError | null,
    content: ReactNode
  ) => (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-stone-900">{title}</h3>
        {error ? (
          <span className="text-xs font-semibold text-red-600">
            HTTP {error.status}: {error.message}
          </span>
        ) : null}
      </div>
      {content}
    </div>
  );

  const actionsList = (actions: SolverActionOutput[], selected: string, onSelect: (value: string) => void) => {
    if (actions.length === 0) {
      return (
        <p className="text-xs text-stone-500">
          Fetch a response to see solver actions.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.actionId}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              selected === action.actionId
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-stone-50 text-stone-700"
            }`}
            type="button"
            onClick={() => onSelect(action.actionId)}
          >
            {action.actionId} · {formatPercent(action.frequency)} · {formatEv(action.ev)}
          </button>
        ))}
      </div>
    );
  };

  const spotQuizSummary = useMemo(() => {
    if (!spotQuizResponse) return null;
    return (
      <div className="space-y-2 text-sm text-stone-700">
        <p>
          <span className="font-semibold text-stone-900">Node hash:</span>{" "}
          {spotQuizResponse.nodeHash}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 p-2">
            <div className="text-xs uppercase text-stone-500">EV Loss vs Mix</div>
            <div className="text-sm font-semibold text-stone-900">
              {formatEv(spotQuizResponse.grade.evLossVsMix)}
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 p-2">
            <div className="text-xs uppercase text-stone-500">EV Loss vs Best</div>
            <div className="text-sm font-semibold text-stone-900">
              {formatEv(spotQuizResponse.grade.evLossVsBest)}
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 p-2">
            <div className="text-xs uppercase text-stone-500">EV Mix</div>
            <div className="text-sm font-semibold text-stone-900">
              {formatEv(spotQuizResponse.grade.evMix)}
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 p-2">
            <div className="text-xs uppercase text-stone-500">EV User</div>
            <div className="text-sm font-semibold text-stone-900">
              {formatEv(spotQuizResponse.grade.evUser)}
            </div>
          </div>
        </div>
      </div>
    );
  }, [spotQuizResponse]);

  const reviewDetailSummary = useMemo(() => {
    if (!reviewDetail) return null;
    if (!reviewDetail.record) {
      return (
        <p className="text-sm text-stone-500">No record found for this id.</p>
      );
    }
    return (
      <div className="space-y-2 text-sm text-stone-700">
        <p>
          <span className="font-semibold text-stone-900">Mode:</span>{" "}
          {reviewDetail.record.mode}
        </p>
        <p>
          <span className="font-semibold text-stone-900">Node hash:</span>{" "}
          {reviewDetail.record.nodeHash}
        </p>
        <p>
          <span className="font-semibold text-stone-900">EV Loss vs Mix:</span>{" "}
          {formatEv(reviewDetail.record.grade.evLossVsMix)}
        </p>
        <p>
          <span className="font-semibold text-stone-900">EV Loss vs Best:</span>{" "}
          {formatEv(reviewDetail.record.grade.evLossVsBest)}
        </p>
      </div>
    );
  }, [reviewDetail]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
          Manual runtime preview
        </p>
        <h1 className="text-3xl font-semibold text-stone-900">
          EV-First Training Preview
        </h1>
        <p className="text-sm text-stone-700">
          Drive the training flows end to end with deterministic seed + session inputs.
        </p>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase text-stone-500">
              Seed
            </label>
            <input
              className="w-48 rounded-lg border border-stone-200 px-3 py-2 text-sm"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase text-stone-500">
              Session ID
            </label>
            <input
              className="w-48 rounded-lg border border-stone-200 px-3 py-2 text-sm"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            />
          </div>
          <button
            className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            type="button"
            onClick={resetSession}
          >
            Reset local session
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {tabButton("spot-quiz", "Spot Quiz")}
        {tabButton("hand-play", "Hand Play")}
        {tabButton("targeted-drill", "Targeted Drill")}
        {tabButton("review", "Review")}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-900">Poker Table Preview (P2.T3)</h2>
          <div className="flex gap-2">
            {(["heads-up", "6-max", "9-max"] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setTableSize(size)}
                className={`rounded border px-3 py-1 text-xs font-semibold ${
                  tableSize === size
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-stone-50 text-stone-700"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        <PokerTable
          tableSize={tableSize}
          seats={[...tableSeatsBySize[tableSize]]}
          zones={[...tableZones]}
        />
      </section>

      {activeMode === "spot-quiz" ? (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Spot Quiz</h2>
            <p className="mt-1 text-sm text-stone-600">
              Request a graded decision for the seed-specific node.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Selected action
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  value={spotQuizActionId}
                  onChange={(event) => setSpotQuizActionId(event.target.value)}
                />
              </div>
              {actionsList(spotQuizActions, spotQuizActionId, setSpotQuizActionId)}
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
                  type="button"
                  onClick={submitSpotQuiz}
                >
                  Get Spot Quiz
                </button>
                <button
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700"
                  type="button"
                  onClick={submitSpotQuiz}
                >
                  Grade / Record
                </button>
              </div>
            </div>
          </div>
          {responseCard(
            "Spot Quiz Response",
            spotQuizError,
            spotQuizSummary ?? (
              <p className="text-sm text-stone-500">No spot quiz fetched yet.</p>
            )
          )}
        </section>
      ) : null}

      {activeMode === "hand-play" ? (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Hand Play</h2>
            <p className="mt-1 text-sm text-stone-600">
              Submit a step with explicit sequence index for determinism.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Sequence index
                </label>
                <input
                  className="mt-1 w-28 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  type="number"
                  value={handPlaySequenceIndex}
                  onChange={(event) =>
                    setHandPlaySequenceIndex(Number(event.target.value))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Selected action
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  value={handPlayActionId}
                  onChange={(event) => setHandPlayActionId(event.target.value)}
                />
              </div>
              {actionsList(handPlayActions, handPlayActionId, setHandPlayActionId)}
              <button
                className="rounded-lg border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
                type="button"
                onClick={submitHandPlay}
              >
                Play Hand Step
              </button>
            </div>
          </div>
          {responseCard(
            "Hand Play Response",
            handPlayError,
            handPlayResponse ? (
              <div className="space-y-2 text-sm text-stone-700">
                <p>
                  <span className="font-semibold text-stone-900">Node hash:</span>{" "}
                  {handPlayResponse.nodeHash}
                </p>
                <p>
                  <span className="font-semibold text-stone-900">
                    EV Loss vs Mix:
                  </span>{" "}
                  {formatEv(handPlayResponse.grade.evLossVsMix)}
                </p>
                <p>
                  <span className="font-semibold text-stone-900">
                    Opponent action:
                  </span>{" "}
                  {handPlayResponse.opponentAction ?? "n/a"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-stone-500">No hand-play step yet.</p>
            )
          )}
        </section>
      ) : null}

      {activeMode === "targeted-drill" ? (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Targeted Drill</h2>
            <p className="mt-1 text-sm text-stone-600">
              Deterministic spot selection from the candidate pool.
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                Filters: streets {targetedFilters.streets?.join(", ")} · buckets{" "}
                {targetedFilters.boardBuckets?.join(", ")}
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Sequence index
                </label>
                <input
                  className="mt-1 w-28 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  type="number"
                  value={targetedSequenceIndex}
                  onChange={(event) =>
                    setTargetedSequenceIndex(Number(event.target.value))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-stone-500">
                  Selected action
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  value={targetedActionId}
                  onChange={(event) => setTargetedActionId(event.target.value)}
                />
              </div>
              {actionsList(targetedActions, targetedActionId, setTargetedActionId)}
              <button
                className="rounded-lg border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
                type="button"
                onClick={submitTargetedDrill}
              >
                Run Targeted Drill
              </button>
            </div>
          </div>
          {responseCard(
            "Targeted Drill Response",
            targetedError,
            targetedResponse ? (
              <div className="space-y-2 text-sm text-stone-700">
                <p>
                  <span className="font-semibold text-stone-900">Spot:</span>{" "}
                  {targetedResponse.spot ? "selected" : "none"}
                </p>
                <p>
                  <span className="font-semibold text-stone-900">Node hash:</span>{" "}
                  {targetedResponse.nodeHash ?? "n/a"}
                </p>
                <p>
                  <span className="font-semibold text-stone-900">
                    EV Loss vs Best:
                  </span>{" "}
                  {formatEv(targetedResponse.grade?.evLossVsBest)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-stone-500">No targeted drill yet.</p>
            )
          )}
        </section>
      ) : null}

      {activeMode === "review" ? (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Review</h2>
            <p className="mt-1 text-sm text-stone-600">
              Fetch session decisions sorted by EV loss.
            </p>
            <button
              className="mt-3 rounded-lg border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={submitReviewList}
            >
              Refresh Review List
            </button>
            {reviewError ? (
              <p className="mt-3 text-xs font-semibold text-red-600">
                HTTP {reviewError.status}: {reviewError.message}
              </p>
            ) : null}
            <div className="mt-4 space-y-2">
              {reviewItems.length === 0 ? (
                <p className="text-sm text-stone-500">
                  No decisions yet. Run a quiz or drill to populate.
                </p>
              ) : (
                reviewItems.map((item) => (
                  <button
                    key={item.id}
                    className="flex w-full flex-col gap-1 rounded-lg border border-stone-200 p-3 text-left text-sm hover:bg-stone-50"
                    type="button"
                    onClick={() => submitReviewDetail(item.id)}
                  >
                    <span className="font-semibold text-stone-900">
                      {item.id}
                    </span>
                    <span className="text-xs text-stone-500">
                      {item.createdAt}
                    </span>
                    <span className="text-xs text-stone-600">
                      EV Loss vs Best: {formatEv(item.grade.evLossVsBest)} · EV Loss
                      vs Mix: {formatEv(item.grade.evLossVsMix)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          {responseCard(
            "Review Detail",
            reviewDetailError,
            reviewDetailSummary ?? (
              <p className="text-sm text-stone-500">
                Select a decision to view details.
              </p>
            )
          )}
        </section>
      ) : null}
    </main>
  );
}
