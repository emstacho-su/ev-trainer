/**
 * Overview: Browser client for session lifecycle endpoints with typed responses.
 * Interacts with: fetch, API routes, and SessionApiError normalization.
 * Importance: Stable integration boundary between UI pages and backend handlers.
 */

import type { Spot } from "../../engine/spot";
import type { ActionId } from "../../engine/types";
import type { SpotFilterInput } from "../filters/spotFilters";
import type {
  NextResponse,
  SessionDetailResponse,
  StartResponse,
  SubmitPracticeResponse,
  SubmitTrainingResponse,
} from "../api/sessionHandlers";
import type { SessionMode } from "../sessionStore";

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class SessionApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SessionApiError";
    this.code = code;
    this.status = status;
  }
}

export interface StartSessionRequest {
  seed: string;
  mode: SessionMode;
  packId: string;
  filters: SpotFilterInput;
  decisionsPerSession?: number;
}

export interface SubmitActionRequest {
  seed: string;
  sessionId: string;
  spot: Spot;
  actionId: ActionId;
}

export interface NextDecisionRequest {
  seed: string;
  sessionId: string;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeError(status: number, body: unknown): SessionApiError {
  const payload = (body ?? {}) as ErrorPayload;
  const code = payload.error?.code ?? "UNKNOWN_ERROR";
  const message = payload.error?.message ?? "Request failed";
  return new SessionApiError(status, code, message);
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await parseResponseBody(response);
  if (!response.ok) {
    throw normalizeError(response.status, body);
  }
  return body as T;
}

export async function startSession(
  request: StartSessionRequest
): Promise<StartResponse> {
  return requestJson<StartResponse>("/api/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function submitAction(
  request: SubmitActionRequest
): Promise<SubmitTrainingResponse | SubmitPracticeResponse> {
  return requestJson<SubmitTrainingResponse | SubmitPracticeResponse>(
    "/api/session/submit",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  );
}

export async function nextDecision(
  request: NextDecisionRequest
): Promise<NextResponse> {
  return requestJson<NextResponse>("/api/session/next", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function getSession(
  sessionId: string,
  seed: string
): Promise<SessionDetailResponse> {
  const query = `?seed=${encodeURIComponent(seed)}`;
  return requestJson<SessionDetailResponse>(`/api/session/${sessionId}${query}`, {
    method: "GET",
  });
}
