/**
 * Barrel re-export for session API modules.
 *
 * Decomposed into:
 *   sessionResponse.ts    — Response types and error builders
 *   sessionValidation.ts  — Input parsing, validation, constants
 *   sessionOrchestrator.ts — Business logic handlers (start/submit/next/get)
 *
 * All existing imports from "sessionHandlers" continue to work unchanged.
 */

// Response types and builders
export type {
  ApiError,
  ApiSuccess,
  ApiFailure,
  ApiResult,
  StartResponse,
  NextResponse,
  SubmitTrainingResponse,
  SubmitPracticeResponse,
  SessionDetailResponse,
  SessionSnapshot,
  SessionEntryView,
} from "./sessionResponse";
export { errorResult } from "./sessionResponse";

// Validation utilities and constants
export type {
  StartRequest,
  NextRequest,
  SubmitRequest,
} from "./sessionValidation";
export {
  DEFAULT_PACK_ID,
  SESSION_ID_HASH_LENGTH,
  DEFAULT_GRADING_CONFIG,
  isObject,
  requireString,
  requireNumber,
  parseMode,
  parseFilters,
  stableStringify,
  deriveSessionId,
  deriveSelectionSessionId,
} from "./sessionValidation";

// Business logic handlers
export {
  handleStart,
  handleNext,
  handleSubmit,
  handleGetSession,
} from "./sessionOrchestrator";
