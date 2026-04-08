// src/lib/v2/api/sessionResponse.ts
// Response types and error builders for session API handlers.

import type { Spot } from "../../engine/spot";
import type { ActionId } from "../../engine/types";
import type { DecisionGrade } from "../../engine/trainingOrchestrator";
import type { SpotFilterInput } from "../filters/spotFilters";
import type { SessionMode } from "../sessionStore";

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
  villainPosition?: string;
}

export interface NextResponse {
  ok: true;
  session: SessionSnapshot;
  spot: Spot;
  villainPosition?: string;
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

export function errorResult(
  status: number,
  code: string,
  message: string
): ApiFailure {
  return { status, body: { error: { code, message } } };
}
