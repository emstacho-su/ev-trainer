import type { Spot } from "../../engine/spot";
import { validateSpot } from "../../engine/spot";
import type { ActionId } from "../../engine/types";
import { combineSeed, createSeededRng } from "../../engine/rng";
import type { SolverNodeOutput } from "../../engine/solverAdapter";
import type { DecisionGrade } from "../../engine/trainingOrchestrator";
import { gradeDecision } from "../../runtime/gradeDecision";
import {
  advanceSession,
  createSession,
  getSession,
} from "../../runtime/v2SessionRegistry";
import type { SpotFilterInput } from "../filters/spotFilters";
import { EffectiveStackBuckets } from "../filters/spotFilters";
import { loadBundledPack } from "../packs/loadBundledPack";
import { PotTypes, type SpotPack } from "../packs/spotPack";
import type { SessionMode, SessionRecord } from "../sessionStore";
import {
  appendSessionEntry,
  createSessionRecord,
  getSessionRecord,
  getSessionRecordById,
  updateSessionSpot,
} from "../sessionStore";
import { getFilteredSpots, selectDeterministicSpot } from "../spotSource";
import { Positions, Streets } from "../../engine/types";

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccess<T> {
  status: number;
  body: T;
}

export interface ApiFailure {
  status: number;
  body: ApiError;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface StartResponse {
  ok: true;
  session: SessionSnapshot;
  spot: Spot;
}

export interface NextResponse {
  ok: true;
  session: SessionSnapshot;
  spot: Spot;
}

export interface SubmitTrainingResponse {
  ok: true;
  result: DecisionGrade;
}

export interface SubmitPracticeResponse {
  ok: true;
  recorded: true;
}

export interface SessionDetailResponse {
  ok: true;
  session: SessionSnapshot;
  reviewAvailable: boolean;
  entries?: SessionEntryView[];
}

export interface SessionSnapshot {
  sessionId: string;
  seed: string;
  mode: SessionMode;
  packId: string;
  decisionIndex: number;
  decisionsPerSession: number;
  isComplete: boolean;
  filters: SpotFilterInput;
}

export interface SessionEntryView {
  index: number;
  spotId: string;
  spot: Spot;
  actionId: ActionId;
  result?: DecisionGrade;
}

interface StartRequest {
  seed: string;
  sessionId?: string;
  mode: SessionMode;
  packId?: string;
  filters?: SpotFilterInput;
  decisionsPerSession?: number;
}

interface NextRequest {
  seed: string;
  sessionId: string;
}

interface SubmitRequest {
  seed: string;
  sessionId: string;
  spot: Spot;
  actionId: ActionId;
}

function errorResult(status: number, code: string, message: string): ApiFailure {
  return { status, body: { error: { code, message } } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(
  source: Record<string, unknown>,
  key: string
): string | null {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value;
}

function requireNumber(
  source: Record<string, unknown>,
  key: string
): number | null {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function parseMode(value: unknown): SessionMode | null {
  if (value === "TRAINING" || value === "PRACTICE") return value;
  return null;
}

function parseFilters(value: unknown): SpotFilterInput | null {
  if (value === undefined) return {};
  if (!isObject(value)) return null;
  const raw = value as Record<string, unknown>;
  const filters: SpotFilterInput = {};

  if (raw.street !== undefined) {
    if (typeof raw.street !== "string" || !Streets.includes(raw.street as any)) return null;
    filters.street = raw.street as SpotFilterInput["street"];
  }
  if (raw.heroPosition !== undefined) {
    if (typeof raw.heroPosition !== "string" || !Positions.includes(raw.heroPosition as any))
      return null;
    filters.heroPosition = raw.heroPosition as SpotFilterInput["heroPosition"];
  }
  if (raw.villainPosition !== undefined) {
    if (
      typeof raw.villainPosition !== "string" ||
      !Positions.includes(raw.villainPosition as any)
    )
      return null;
    filters.villainPosition = raw.villainPosition as SpotFilterInput["villainPosition"];
  }
  if (raw.potType !== undefined) {
    if (
      typeof raw.potType !== "string" ||
      (raw.potType !== "ANY" && !PotTypes.includes(raw.potType as any))
    )
      return null;
    filters.potType = raw.potType as SpotFilterInput["potType"];
  }
  if (raw.effectiveStackBbBucket !== undefined) {
    if (
      typeof raw.effectiveStackBbBucket !== "string" ||
      !EffectiveStackBuckets.includes(raw.effectiveStackBbBucket as any)
    )
      return null;
    filters.effectiveStackBbBucket =
      raw.effectiveStackBbBucket as SpotFilterInput["effectiveStackBbBucket"];
  }

  return filters;
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deriveSessionId(input: StartRequest, filters: SpotFilterInput): string {
  const packed = stableStringify({
    seed: input.seed,
    packId: input.packId ?? "ev-dev-pack-v1",
    mode: input.mode,
    filters,
  });
  return `sess_${packed.length}_${packed.slice(0, 12).replace(/[^a-zA-Z0-9]/g, "")}`;
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

function makeMockSolverOutput(spot: Spot, actionId: ActionId): SolverNodeOutput {
  const rng = createSeededRng(combineSeed([spot.spotId, actionId]));
  const frequency = 0.2 + rng.next() * 0.6;
  const otherFrequency = 1 - frequency;
  const evBase = Math.round((rng.next() * 4 - 2) * 100) / 100;
  const evOther = Math.round((evBase - 0.5 + rng.next()) * 100) / 100;
  const otherActionId = actionId === "ALT" ? "ALT_2" : "ALT";

  return {
    status: "ok",
    units: "bb",
    actions: [
      { actionId, frequency, ev: evBase },
      { actionId: otherActionId, frequency: otherFrequency, ev: evOther },
    ],
  };
}

function gradeAction(spot: Spot, actionId: ActionId): DecisionGrade {
  const output = makeMockSolverOutput(spot, actionId);
  return gradeDecision(output, actionId, { epsilon: 0.01, gradeBy: "evLossVsBest" });
}

export function handleStart(input: unknown): ApiResult<StartResponse> {
  if (!isObject(input)) return errorResult(400, "INVALID_ARGUMENT", "body must be an object");
  const seed = requireString(input, "seed");
  if (!seed) return errorResult(400, "INVALID_ARGUMENT", "seed is required");
  const mode = parseMode(input.mode);
  if (!mode) return errorResult(400, "INVALID_ARGUMENT", "mode is required");

  const filters = parseFilters(input.filters);
  if (filters === null) {
    return errorResult(400, "INVALID_ARGUMENT", "filters is invalid");
  }

  const packResult = getPack(input.packId as string | undefined);
  if ("status" in packResult) return packResult;
  const pack = packResult;

  const sessionId =
    (typeof input.sessionId === "string" && input.sessionId.trim().length > 0
      ? input.sessionId
      : null) ?? deriveSessionId({ seed, mode, packId: pack.packId }, filters);

  let decisionsPerSession: number | undefined;
  if (input.decisionsPerSession !== undefined) {
    const parsedDecisionsPerSession = requireNumber(input, "decisionsPerSession");
    if (
      parsedDecisionsPerSession === null ||
      !Number.isInteger(parsedDecisionsPerSession) ||
      parsedDecisionsPerSession <= 0
    ) {
      return errorResult(
        400,
        "INVALID_ARGUMENT",
        "decisionsPerSession must be a positive integer"
      );
    }
    decisionsPerSession = parsedDecisionsPerSession;
  }

  const registrySnapshot = createSession({
    sessionId,
    seed,
    decisionsPerSession,
  });

  const record = createSessionRecord({
    sessionId,
    seed,
    mode,
    packId: pack.packId,
    filters,
    decisionIndex: registrySnapshot.decisionIndex,
    decisionsPerSession: registrySnapshot.decisionsPerSession,
  });

  const candidates = getFilteredSpots(pack, filters);
  if (candidates.length === 0) {
    return errorResult(404, "NO_CANDIDATES", "no spots match filters");
  }
  const selected = selectDeterministicSpot(
    candidates,
    seed,
    sessionId,
    registrySnapshot.decisionIndex
  );
  if (!selected) {
    return errorResult(404, "NO_CANDIDATES", "no spots match filters");
  }

  updateSessionSpot(sessionId, seed, registrySnapshot.decisionIndex, selected.spot);

  return {
    status: 200,
    body: {
      ok: true,
      session: buildSessionSnapshot(record),
      spot: selected.spot,
    },
  };
}

export function handleNext(input: unknown): ApiResult<NextResponse> {
  if (!isObject(input)) return errorResult(400, "INVALID_ARGUMENT", "body must be an object");
  const seed = requireString(input, "seed");
  const sessionId = requireString(input, "sessionId");
  if (!seed) return errorResult(400, "INVALID_ARGUMENT", "seed is required");
  if (!sessionId) return errorResult(400, "INVALID_ARGUMENT", "sessionId is required");

  const record = getSessionRecord(sessionId, seed);
  if (!record) return errorResult(404, "NOT_FOUND", "session not found");

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
    sessionId,
    registrySnapshot.decisionIndex
  );
  if (!selected) {
    return errorResult(404, "NO_CANDIDATES", "no spots match filters");
  }

  updateSessionSpot(sessionId, seed, registrySnapshot.decisionIndex, selected.spot);

  return {
    status: 200,
    body: {
      ok: true,
      session: buildSessionSnapshot(record),
      spot: selected.spot,
    },
  };
}

export function handleSubmit(input: unknown): ApiResult<SubmitTrainingResponse | SubmitPracticeResponse> {
  if (!isObject(input)) return errorResult(400, "INVALID_ARGUMENT", "body must be an object");
  const seed = requireString(input, "seed");
  const sessionId = requireString(input, "sessionId");
  if (!seed) return errorResult(400, "INVALID_ARGUMENT", "seed is required");
  if (!sessionId) return errorResult(400, "INVALID_ARGUMENT", "sessionId is required");

  const record = getSessionRecord(sessionId, seed);
  if (!record) return errorResult(404, "NOT_FOUND", "session not found");

  const spotValue = input.spot;
  if (!isObject(spotValue)) return errorResult(400, "INVALID_ARGUMENT", "spot is required");
  const actionId = requireString(input, "actionId");
  if (!actionId) return errorResult(400, "INVALID_ARGUMENT", "actionId is required");

  let spot: Spot;
  try {
    spot = validateSpot(spotValue as unknown as Spot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(400, "INVALID_ARGUMENT", message);
  }

  if (!record.currentSpot || record.currentSpot.spotId !== spot.spotId) {
    return errorResult(409, "INVALID_STATE", "spot does not match current session state");
  }

  const grade = gradeAction(spot, actionId as ActionId);
  appendSessionEntry(sessionId, seed, {
    index: record.decisionIndex,
    spotId: spot.spotId,
    spot,
    actionId: actionId as ActionId,
    result: grade,
  });

  if (record.mode === "PRACTICE") {
    return { status: 200, body: { ok: true, recorded: true } };
  }
  return { status: 200, body: { ok: true, result: grade } };
}

export function handleGetSession(sessionId: string, seed?: string | null): ApiResult<SessionDetailResponse> {
  const record = seed ? getSessionRecord(sessionId, seed) : getSessionRecordById(sessionId);
  if (!record) return errorResult(404, "NOT_FOUND", "session not found");

  const registrySnapshot = getSession(record.sessionId, record.seed);
  if (!registrySnapshot) return errorResult(404, "NOT_FOUND", "session not found");

  const isComplete = registrySnapshot.isComplete;
  const reviewAvailable = record.mode === "TRAINING" || isComplete;

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
      body: {
        ok: true,
        session: sessionSnapshot,
        reviewAvailable: false,
      },
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
