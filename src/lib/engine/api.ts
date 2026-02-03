// src/lib/engine/api.ts

import type { ActionId } from "./types";
import type { CanonicalNode } from "./nodeTypes";
import type { SpotCandidate, TargetedDrillFilters } from "./spotSelection";
import type { SpotSource } from "./spotSource";
import type { Session } from "./session";
import type {
  HandPlayResponse,
  SpotQuizResponse,
  TargetedDrillResponse,
} from "./trainingApi";

// Request for applying a user action in a given training mode.
export interface ApplyActionRequest {
  mode: "spot-quiz" | "hand-play" | "targeted-drill";
  node: CanonicalNode;
  userActionId: ActionId;
  sequenceIndex?: number;
  candidates?: SpotCandidate[];
  filters?: TargetedDrillFilters;
  sessionId?: string;
}

export interface SpotQuizApplyActionRequest extends ApplyActionRequest {
  mode: "spot-quiz";
}

export interface HandPlayApplyActionRequest extends ApplyActionRequest {
  mode: "hand-play";
  sequenceIndex: number;
}

export interface TargetedDrillApplyActionRequest extends ApplyActionRequest {
  mode: "targeted-drill";
  candidates: SpotCandidate[];
  filters: TargetedDrillFilters;
}

// Selects the next spot from a SpotSource with deterministic seeding.
export function nextSpot(
  source: SpotSource,
  filters: TargetedDrillFilters,
  seed?: string,
  sequenceIndex?: number
): SpotCandidate | null {
  return source.select(filters, seed, sequenceIndex);
}

// Applies a user action and returns grading output for the selected mode.
export function applyAction(
  session: Session,
  request: SpotQuizApplyActionRequest
): SpotQuizResponse;
export function applyAction(
  session: Session,
  request: HandPlayApplyActionRequest
): HandPlayResponse;
export function applyAction(
  session: Session,
  request: TargetedDrillApplyActionRequest
): TargetedDrillResponse;
export function applyAction(
  session: Session,
  request: ApplyActionRequest
): SpotQuizResponse | HandPlayResponse | TargetedDrillResponse {
  if (request.mode === "spot-quiz") {
    return session.trainingApi.spotQuiz({
      node: request.node,
      userActionId: request.userActionId,
      sessionId: request.sessionId ?? session.config.sessionId,
    });
  }

  if (request.mode === "hand-play") {
    if (request.sequenceIndex === undefined) {
      throw new Error("sequenceIndex is required for hand-play");
    }
    return session.trainingApi.handPlayStep({
      node: request.node,
      userActionId: request.userActionId,
      sequenceIndex: request.sequenceIndex,
      sessionId: request.sessionId ?? session.config.sessionId,
    });
  }

  if (!request.candidates || !request.filters) {
    throw new Error("candidates and filters are required for targeted-drill");
  }

  return session.trainingApi.targetedDrill({
    candidates: request.candidates,
    filters: request.filters,
    userActionId: request.userActionId,
    sequenceIndex: request.sequenceIndex,
    sessionId: request.sessionId ?? session.config.sessionId,
  });
}
