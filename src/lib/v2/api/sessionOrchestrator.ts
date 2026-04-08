// src/lib/v2/api/sessionOrchestrator.ts
// Core session lifecycle business logic for start/submit/next/get.

import type { Spot } from "../../engine/spot";
import { validateSpot } from "../../engine/spot";
import type { ActionId } from "../../engine/types";
import { combineSeed, createSeededRng } from "../../engine/rng";
import type { SolverNodeOutput } from "../../engine/solverAdapter";
import { gradeDecision } from "../../runtime/gradeDecision";
import {
  advanceSession,
  createSession,
  getSession,
} from "../../runtime/v2SessionRegistry";
import { loadBundledPack } from "../packs/loadBundledPack";
import type { SpotPack } from "../packs/spotPack";
import type { SessionRecord } from "../sessionStore";
import {
  appendSessionEntry,
  createSessionRecord,
  getSessionRecord,
  updateSessionSpot,
} from "../sessionStore";
import { getFilteredSpots, selectDeterministicSpot } from "../spotSource";

import type {
  ApiFailure,
  ApiResult,
  SessionDetailResponse,
  SessionSnapshot,
  StartResponse,
  NextResponse,
  SubmitTrainingResponse,
  SubmitPracticeResponse,
} from "./sessionResponse";
import { errorResult } from "./sessionResponse";
import {
  DEFAULT_GRADING_CONFIG,
  isObject,
  requireString,
  requireNumber,
  parseMode,
  parseFilters,
  deriveSessionId,
  deriveSelectionSessionId,
} from "./sessionValidation";

// ─── Helpers ────────────────────────────────────────────────────────────────

function checkSessionOwnership(
  session: SessionRecord,
  userId?: string
): ApiFailure | null {
  if (session.userId && session.userId !== userId) {
    return errorResult(
      403,
      "FORBIDDEN",
      "Cannot access another user's session"
    );
  }
  return null;
}

function getPack(packId?: string): SpotPack | ApiFailure {
  const pack = loadBundledPack();
  if (packId && packId !== pack.packId) {
    return errorResult(404, "PACK_NOT_FOUND", "packId not found");
  }
  return pack;
}

function buildSessionSnapshot(record: SessionRecord): SessionSnapshot {
  return {
    sessionId: record.sessionId,
    seed: record.seed,
    mode: record.mode,
    packId: record.packId,
    decisionIndex: record.decisionIndex,
    decisionsPerSession: record.decisionsPerSession,
    isComplete: record.decisionIndex >= record.decisionsPerSession,
    filters: record.filters,
  };
}

function makeMockSolverOutput(
  spot: Spot,
  actionId: ActionId
): SolverNodeOutput {
  const rng = createSeededRng(combineSeed([spot.spotId, actionId]));

  if (spot.board.length === 0) {
    const foldFreq = 0.1 + rng.next() * 0.3;
    const callFreq = 0.2 + rng.next() * 0.3;
    const raise22Freq =
      (1.0 - foldFreq - callFreq) * (0.1 + rng.next() * 0.2);
    const raise25Freq =
      (1.0 - foldFreq - callFreq) * (0.3 + rng.next() * 0.2);
    const raise30Freq =
      1.0 - foldFreq - callFreq - raise22Freq - raise25Freq;

    const bestEv = Math.round((rng.next() * 2 + 1) * 100) / 100;
    const callEv =
      Math.round((bestEv - 0.3 - rng.next() * 0.5) * 100) / 100;
    const foldEv =
      Math.round((callEv - 0.5 - rng.next() * 0.5) * 100) / 100;

    return {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "FOLD", frequency: foldFreq, ev: foldEv },
        { actionId: "CALL", frequency: callFreq, ev: callEv },
        {
          actionId: "RAISE_2.2X",
          frequency: raise22Freq,
          ev:
            Math.round((bestEv - 0.1 - rng.next() * 0.3) * 100) / 100,
        },
        { actionId: "RAISE_2.5X", frequency: raise25Freq, ev: bestEv },
        {
          actionId: "RAISE_3.0X",
          frequency: raise30Freq,
          ev:
            Math.round((bestEv - 0.05 - rng.next() * 0.2) * 100) / 100,
        },
      ],
    };
  }

  const facesBet = spot.history.some(
    (a) => a.startsWith("BET_") || a.startsWith("RAISE_") || a === "CALL"
  );

  if (facesBet) {
    const foldFreq = 0.1 + rng.next() * 0.3;
    const callFreq = 0.2 + rng.next() * 0.3;
    const raise22Freq =
      (1.0 - foldFreq - callFreq) * (0.1 + rng.next() * 0.2);
    const raise25Freq =
      (1.0 - foldFreq - callFreq) * (0.3 + rng.next() * 0.2);
    const raise30Freq =
      1.0 - foldFreq - callFreq - raise22Freq - raise25Freq;

    const bestEv = Math.round((rng.next() * 2 + 1) * 100) / 100;
    const callEv =
      Math.round((bestEv - 0.3 - rng.next() * 0.5) * 100) / 100;
    const foldEv =
      Math.round((callEv - 0.5 - rng.next() * 0.5) * 100) / 100;

    return {
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "FOLD", frequency: foldFreq, ev: foldEv },
        { actionId: "CALL", frequency: callFreq, ev: callEv },
        {
          actionId: "RAISE_2.2X",
          frequency: raise22Freq,
          ev:
            Math.round((bestEv - 0.1 - rng.next() * 0.3) * 100) / 100,
        },
        { actionId: "RAISE_2.5X", frequency: raise25Freq, ev: bestEv },
        {
          actionId: "RAISE_3.0X",
          frequency: raise30Freq,
          ev:
            Math.round((bestEv - 0.05 - rng.next() * 0.2) * 100) / 100,
        },
      ],
    };
  }

  const checkFreq = 0.2 + rng.next() * 0.3;
  const remaining = 1.0 - checkFreq;
  const bet33Freq = remaining * (0.1 + rng.next() * 0.2);
  const bet50Freq = remaining * (0.15 + rng.next() * 0.15);
  const bet75Freq = remaining * (0.2 + rng.next() * 0.2);
  const bet100Freq = remaining - bet33Freq - bet50Freq - bet75Freq;

  const checkEv = Math.round((rng.next() * 2 - 0.5) * 100) / 100;
  const bestBetEv =
    Math.round((checkEv + 0.5 + rng.next() * 1.5) * 100) / 100;

  return {
    status: "ok",
    units: "bb",
    actions: [
      { actionId: "CHECK", frequency: checkFreq, ev: checkEv },
      {
        actionId: "BET_33PCT",
        frequency: bet33Freq,
        ev:
          Math.round((bestBetEv - 0.1 - rng.next() * 0.3) * 100) / 100,
      },
      {
        actionId: "BET_50PCT",
        frequency: bet50Freq,
        ev:
          Math.round((bestBetEv - 0.05 - rng.next() * 0.2) * 100) / 100,
      },
      { actionId: "BET_75PCT", frequency: bet75Freq, ev: bestBetEv },
      {
        actionId: "BET_100PCT",
        frequency: bet100Freq,
        ev:
          Math.round((bestBetEv - 0.1 - rng.next() * 0.2) * 100) / 100,
      },
    ],
  };
}

function gradeAction(spot: Spot, actionId: ActionId): import("../../engine/trainingOrchestrator").DecisionGrade {
  const output = makeMockSolverOutput(spot, actionId);
  return gradeDecision(output, actionId, DEFAULT_GRADING_CONFIG);
}

// ─── Handlers ───────────────────────────────────────────────────────────────

export async function handleStart(
  input: unknown,
  userId?: string
): Promise<ApiResult<StartResponse>> {
  if (!isObject(input))
    return errorResult(400, "INVALID_ARGUMENT", "body must be an object");
  const seed = requireString(input, "seed");
  if (!seed) return errorResult(400, "INVALID_ARGUMENT", "seed is required");
  const mode = parseMode(input.mode);
  if (!mode) return errorResult(400, "INVALID_ARGUMENT", "mode is required");

  const filters = parseFilters(input.filters);
  if (filters === null) {
    return errorResult(400, "INVALID_ARGUMENT", "filters is invalid");
  }

  const packResult = getPack(
    typeof input.packId === "string" ? input.packId : undefined
  );
  if ("status" in packResult) return packResult;
  const pack = packResult;

  const sessionId =
    (typeof input.sessionId === "string" && input.sessionId.trim().length > 0
      ? input.sessionId
      : null) ?? deriveSessionId({ seed, mode, packId: pack.packId }, filters);

  let decisionsPerSession: number | undefined;
  if (input.decisionsPerSession !== undefined) {
    const parsed = requireNumber(input, "decisionsPerSession");
    if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) {
      return errorResult(
        400,
        "INVALID_ARGUMENT",
        "decisionsPerSession must be a positive integer"
      );
    }
    decisionsPerSession = parsed;
  }

  const registrySnapshot = createSession({
    sessionId,
    seed,
    decisionsPerSession,
  });

  const record = await createSessionRecord({
    sessionId,
    seed,
    mode,
    packId: pack.packId,
    filters,
    decisionIndex: registrySnapshot.decisionIndex,
    decisionsPerSession: registrySnapshot.decisionsPerSession,
    userId: userId ?? null,
  });

  const candidates = getFilteredSpots(pack, filters);
  if (candidates.length === 0) {
    return errorResult(404, "NO_CANDIDATES", "no spots match filters");
  }
  const selected = selectDeterministicSpot(
    candidates,
    seed,
    deriveSelectionSessionId({
      seed,
      packId: pack.packId,
      filters,
    }),
    registrySnapshot.decisionIndex
  );
  if (!selected) {
    return errorResult(404, "NO_CANDIDATES", "no spots match filters");
  }

  await updateSessionSpot(
    sessionId,
    seed,
    registrySnapshot.decisionIndex,
    selected.spot
  );

  return {
    status: 200,
    body: {
      ok: true,
      session: buildSessionSnapshot(record),
      spot: selected.spot,
      villainPosition: selected.meta.villainPosition,
    },
  };
}

export async function handleNext(
  input: unknown,
  userId?: string
): Promise<ApiResult<NextResponse>> {
  if (!isObject(input))
    return errorResult(400, "INVALID_ARGUMENT", "body must be an object");
  const seed = requireString(input, "seed");
  const sessionId = requireString(input, "sessionId");
  if (!seed) return errorResult(400, "INVALID_ARGUMENT", "seed is required");
  if (!sessionId)
    return errorResult(400, "INVALID_ARGUMENT", "sessionId is required");

  const record = await getSessionRecord(sessionId, seed);
  if (!record) return errorResult(404, "NOT_FOUND", "session not found");

  const ownershipError = checkSessionOwnership(record, userId);
  if (ownershipError) return ownershipError;
  const hasSubmissionForCurrentDecision = record.entries.some(
    (entry) => entry.index === record.decisionIndex
  );
  if (!hasSubmissionForCurrentDecision) {
    return errorResult(
      409,
      "SUBMIT_REQUIRED",
      "submit the current decision before requesting next"
    );
  }

  let registrySnapshot;
  try {
    registrySnapshot = advanceSession(sessionId, seed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("complete")) {
      return errorResult(409, "SESSION_COMPLETE", "session is complete");
    }
    return errorResult(404, "NOT_FOUND", "session not found");
  }
  if (registrySnapshot.isComplete) {
    return errorResult(409, "SESSION_COMPLETE", "session is complete");
  }

  const packResult = getPack(record.packId);
  if ("status" in packResult) return packResult;
  const pack = packResult;

  const candidates = getFilteredSpots(pack, record.filters);
  if (candidates.length === 0) {
    return errorResult(404, "NO_CANDIDATES", "no spots match filters");
  }
  const selected = selectDeterministicSpot(
    candidates,
    seed,
    deriveSelectionSessionId({
      seed,
      packId: record.packId,
      filters: record.filters,
    }),
    registrySnapshot.decisionIndex
  );
  if (!selected) {
    return errorResult(404, "NO_CANDIDATES", "no spots match filters");
  }

  await updateSessionSpot(
    sessionId,
    seed,
    registrySnapshot.decisionIndex,
    selected.spot
  );

  return {
    status: 200,
    body: {
      ok: true,
      session: buildSessionSnapshot(record),
      spot: selected.spot,
      villainPosition: selected.meta.villainPosition,
    },
  };
}

export async function handleSubmit(
  input: unknown,
  userId?: string
): Promise<ApiResult<SubmitTrainingResponse | SubmitPracticeResponse>> {
  if (!isObject(input))
    return errorResult(400, "INVALID_ARGUMENT", "body must be an object");
  const seed = requireString(input, "seed");
  const sessionId = requireString(input, "sessionId");
  if (!seed) return errorResult(400, "INVALID_ARGUMENT", "seed is required");
  if (!sessionId)
    return errorResult(400, "INVALID_ARGUMENT", "sessionId is required");

  const record = await getSessionRecord(sessionId, seed);
  if (!record) return errorResult(404, "NOT_FOUND", "session not found");

  const ownershipError = checkSessionOwnership(record, userId);
  if (ownershipError) return ownershipError;

  const spotValue = input.spot;
  if (!isObject(spotValue))
    return errorResult(400, "INVALID_ARGUMENT", "spot is required");
  const actionId = requireString(input, "actionId");
  if (!actionId)
    return errorResult(400, "INVALID_ARGUMENT", "actionId is required");

  let spot: Spot;
  try {
    spot = validateSpot(spotValue as Record<string, unknown> as Spot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(400, "INVALID_ARGUMENT", message);
  }

  if (!record.currentSpot || record.currentSpot.spotId !== spot.spotId) {
    return errorResult(
      409,
      "INVALID_STATE",
      "spot does not match current session state"
    );
  }

  const existingEntry = record.entries.find(
    (entry) => entry.index === record.decisionIndex
  );
  if (existingEntry) {
    if (existingEntry.actionId !== actionId) {
      return errorResult(
        409,
        "DUPLICATE_SUBMIT_CONFLICT",
        "decision already submitted with a different action"
      );
    }
    if (record.mode === "PRACTICE") {
      return { status: 200, body: { ok: true, recorded: true } };
    }
    return {
      status: 200,
      body: {
        ok: true,
        result: existingEntry.result ?? gradeAction(spot, actionId),
      },
    };
  }

  const grade = gradeAction(spot, actionId);
  await appendSessionEntry(sessionId, seed, {
    index: record.decisionIndex,
    spotId: spot.spotId,
    spot,
    actionId,
    result: grade,
  });

  if (record.mode === "PRACTICE") {
    return { status: 200, body: { ok: true, recorded: true } };
  }
  return { status: 200, body: { ok: true, result: grade } };
}

export async function handleGetSession(
  sessionId: string,
  seed?: string | null,
  userId?: string
): Promise<ApiResult<SessionDetailResponse>> {
  if (!seed || seed.trim().length === 0) {
    return errorResult(400, "INVALID_ARGUMENT", "seed is required");
  }
  const record = await getSessionRecord(sessionId, seed);
  if (!record) return errorResult(404, "NOT_FOUND", "session not found");

  const ownershipError = checkSessionOwnership(record, userId);
  if (ownershipError) return ownershipError;

  const registrySnapshot = getSession(record.sessionId, record.seed);
  if (!registrySnapshot)
    return errorResult(404, "NOT_FOUND", "session not found");

  if (
    record.entries.length < registrySnapshot.decisionIndex ||
    record.entries.length > registrySnapshot.decisionIndex + 1
  ) {
    return errorResult(
      409,
      "PROTOCOL_STATE_INVALID",
      "entries are out of sync with decision index"
    );
  }
  if (
    registrySnapshot.isComplete &&
    record.entries.length !== registrySnapshot.decisionsPerSession
  ) {
    return errorResult(
      409,
      "PROTOCOL_STATE_INVALID",
      "completed sessions must contain submissions for all decisions"
    );
  }

  const isComplete = registrySnapshot.isComplete;
  const reviewAvailable = isComplete;

  const sessionSnapshot: SessionSnapshot = {
    sessionId: record.sessionId,
    seed: record.seed,
    mode: record.mode,
    packId: record.packId,
    decisionIndex: registrySnapshot.decisionIndex,
    decisionsPerSession: registrySnapshot.decisionsPerSession,
    isComplete,
    filters: record.filters,
  };

  if (!reviewAvailable) {
    return {
      status: 200,
      body: { ok: true, session: sessionSnapshot, reviewAvailable: false },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      session: sessionSnapshot,
      reviewAvailable: true,
      entries: record.entries.map((entry) => ({
        index: entry.index,
        spotId: entry.spotId,
        spot: entry.spot,
        actionId: entry.actionId,
        result: entry.result,
      })),
    },
  };
}
