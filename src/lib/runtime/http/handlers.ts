// src/lib/runtime/http/handlers.ts

import type { CanonicalNode } from "../../engine/nodeTypes";
import type { ActionId } from "../../engine/types";
import type {
  HandPlayResponse,
  ReviewDetailResponse,
  ReviewListResponse,
  SpotQuizResponse,
  TargetedDrillResponse,
} from "../../engine/trainingApi";
import type { ReviewSort } from "../../engine/decisionStore";
import type { TrainingMode } from "../../engine/trainingOrchestrator";
import type { SpotCandidate, TargetedDrillFilters } from "../../engine/spotSelection";
import { getRuntime } from "../runtimeRegistry";

export interface ErrorResponse {
  error: string;
}

export interface HandlerSuccess<T> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export interface HandlerError {
  status: number;
  body: ErrorResponse;
  headers?: Record<string, string>;
}

export type HandlerResult<T> = HandlerSuccess<T> | HandlerError;

interface SessionInput {
  seed: string;
  sessionId: string;
}

function badRequest(message: string): HandlerError {
  return { status: 400, body: { error: message } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requireString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value;
}

function requireNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function requireSession(input: unknown): SessionInput | HandlerError {
  if (!isObject(input)) return badRequest("body must be an object");
  const seed = requireString(input, "seed");
  const sessionId = requireString(input, "sessionId");
  if (!seed) return badRequest("seed is required");
  if (!sessionId) return badRequest("sessionId is required");
  return { seed, sessionId };
}

function isHandlerError(value: SessionInput | HandlerError): value is HandlerError {
  return "status" in value && "body" in value;
}

function asCanonicalNode(value: Record<string, unknown>): CanonicalNode {
  return value as unknown as CanonicalNode;
}

function parseOptionalModes(
  input: Record<string, unknown>
): TrainingMode[] | undefined | "invalid" {
  const modes = input.modes;
  if (modes === undefined) return undefined;
  if (!Array.isArray(modes)) return "invalid";
  const filtered = modes.filter((mode) => typeof mode === "string") as TrainingMode[];
  return filtered.length > 0 ? filtered : [];
}

function parseOptionalSort(input: Record<string, unknown>): ReviewSort | undefined | "invalid" {
  const sort = input.sort;
  if (sort === undefined) return undefined;
  if (sort === "createdAtDesc" || sort === "evLossVsMixDesc") return sort;
  return "invalid";
}

export function handleSpotQuiz(input: unknown): HandlerResult<SpotQuizResponse> {
  const session = requireSession(input);
  if (isHandlerError(session)) return session;
  const body = input as Record<string, unknown>;

  const node = body.node;
  if (!isObject(node)) return badRequest("node is required");
  const userActionId = requireString(body, "userActionId");
  if (!userActionId) return badRequest("userActionId is required");

  const runtime = getRuntime(session.seed, session.sessionId);
  const result = runtime.trainingApi.spotQuiz({
    node: asCanonicalNode(node),
    userActionId: userActionId as ActionId,
    sessionId: session.sessionId,
  });

  return { status: 200, body: result };
}

export function handleHandPlay(input: unknown): HandlerResult<HandPlayResponse> {
  const session = requireSession(input);
  if (isHandlerError(session)) return session;
  const body = input as Record<string, unknown>;

  const node = body.node;
  if (!isObject(node)) return badRequest("node is required");
  const userActionId = requireString(body, "userActionId");
  if (!userActionId) return badRequest("userActionId is required");
  const sequenceIndex = requireNumber(body, "sequenceIndex");
  if (sequenceIndex === null) return badRequest("sequenceIndex is required");

  const runtime = getRuntime(session.seed, session.sessionId);
  const result = runtime.trainingApi.handPlayStep({
    node: asCanonicalNode(node),
    userActionId: userActionId as ActionId,
    sequenceIndex,
    sessionId: session.sessionId,
  });

  return { status: 200, body: result };
}

export function handleTargetedDrill(input: unknown): HandlerResult<TargetedDrillResponse> {
  const session = requireSession(input);
  if (isHandlerError(session)) return session;
  const body = input as Record<string, unknown>;

  const candidatesValue = body.candidates;
  if (!Array.isArray(candidatesValue)) return badRequest("candidates is required");
  const candidates = candidatesValue.filter((candidate) =>
    isObject(candidate) && isObject((candidate as Record<string, unknown>).node)
  ) as SpotCandidate[];
  if (candidates.length === 0) return badRequest("candidates must include nodes");

  const filtersValue = body.filters;
  if (filtersValue === undefined) return badRequest("filters is required");
  if (!isObject(filtersValue)) return badRequest("filters must be an object");

  const userActionId = requireString(body, "userActionId");
  if (!userActionId) return badRequest("userActionId is required");

  const sequenceIndex = body.sequenceIndex;
  if (sequenceIndex !== undefined && typeof sequenceIndex !== "number") {
    return badRequest("sequenceIndex must be a number");
  }

  const runtime = getRuntime(session.seed, session.sessionId);
  const result = runtime.trainingApi.targetedDrill({
    candidates,
    filters: filtersValue as TargetedDrillFilters,
    userActionId: userActionId as ActionId,
    sequenceIndex: typeof sequenceIndex === "number" ? sequenceIndex : undefined,
    sessionId: session.sessionId,
  });

  return { status: 200, body: result };
}

export function handleReviewList(input: unknown): HandlerResult<ReviewListResponse> {
  const session = requireSession(input);
  if (isHandlerError(session)) return session;
  const body = input as Record<string, unknown>;

  const modes = parseOptionalModes(body);
  if (modes === "invalid") return badRequest("modes must be an array of strings");
  const sort = parseOptionalSort(body);
  if (sort === "invalid") return badRequest("sort is invalid");
  if (body.offset !== undefined && requireNumber(body, "offset") === null) {
    return badRequest("offset must be a number");
  }
  if (body.limit !== undefined && requireNumber(body, "limit") === null) {
    return badRequest("limit must be a number");
  }

  const runtime = getRuntime(session.seed, session.sessionId);
  const result = runtime.trainingApi.reviewList({
    sessionId: session.sessionId,
    modes,
    sort,
    offset: requireNumber(body, "offset") ?? undefined,
    limit: requireNumber(body, "limit") ?? undefined,
  });

  return { status: 200, body: result };
}

export function handleReviewDetail(input: unknown): HandlerResult<ReviewDetailResponse> {
  const session = requireSession(input);
  if (isHandlerError(session)) return session;
  const body = input as Record<string, unknown>;

  const id = requireString(body, "id");
  if (!id) return badRequest("id is required");

  const node = body.node;
  if (node !== undefined && !isObject(node)) return badRequest("node must be an object");

  const runtime = getRuntime(session.seed, session.sessionId);
  const result = runtime.trainingApi.reviewDetail({
    id,
    node: node ? asCanonicalNode(node) : undefined,
  });

  return { status: 200, body: result };
}
