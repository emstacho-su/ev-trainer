// src/lib/engine/index.ts

// Public engine API surface.
export { createSession, type Session, type SessionConfig } from "./session";
export { applyAction, nextSpot, type ApplyActionRequest } from "./api";
export { gradeDecision, type ScoringConfig, type ScoringThresholds } from "./grading";
export { serializeSession, deserializeSession, type SessionRecord } from "./sessionRecord";
export { InMemorySpotSource, type SpotSource } from "./spotSource";
export { actionToId, idToAction, validateAction, type Action } from "./action";
export { computeSpotId, validateSpot, type Spot } from "./spot";
export type { DecisionRecord } from "./trainingOrchestrator";
export {
  createInitialGameState,
  computeLegalActions,
  validateActionLegality,
  applyAction as applyGameAction,
  parseActionId,
  type GameState,
  type LegalActions,
  type ActionValidation,
} from "./gameState";
export {
  calculateMinBet,
  calculateMinRaise,
  calculateMaxBet,
  calculateMaxRaise,
  calculatePotSizedBet,
  getStandardBetSizes,
  getStandardRaiseSizes,
  isAllIn,
  doesAllInReopenAction,
} from "./betSizing";
