// src/lib/runtime/http/handlers.ts

import type {
  HandPlayResponse,
  ReviewDetailResponse,
  ReviewListResponse,
  SpotQuizResponse,
  TargetedDrillResponse,
} from "../../engine/trainingApi";

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

function notImplemented<T>(): HandlerResult<T> {
  return {
    status: 501,
    body: { error: "Training handlers not wired yet." },
  };
}

export function handleSpotQuiz(_input: unknown): HandlerResult<SpotQuizResponse> {
  return notImplemented();
}

export function handleHandPlay(_input: unknown): HandlerResult<HandPlayResponse> {
  return notImplemented();
}

export function handleTargetedDrill(_input: unknown): HandlerResult<TargetedDrillResponse> {
  return notImplemented();
}

export function handleReviewList(_input: unknown): HandlerResult<ReviewListResponse> {
  return notImplemented();
}

export function handleReviewDetail(_input: unknown): HandlerResult<ReviewDetailResponse> {
  return notImplemented();
}
