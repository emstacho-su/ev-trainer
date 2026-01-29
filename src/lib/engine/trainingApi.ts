// src/lib/engine/trainingApi.ts

import type { SpotFilters } from "./filters";
import type { NodeCache } from "./nodeCache";
import type { CanonicalNode } from "./nodeTypes";
import type { ActionId } from "./types";
import type { SolverNodeOutput } from "./solverAdapter";
import type {
  DecisionRecord,
  DecisionGrade,
  HandPlayActor,
  TrainingMode,
  RecordFactory,
  DecisionRequestSnapshot,
} from "./trainingOrchestrator";
import {
  advanceHandPlayStep,
  runSpotQuizDecision,
  runTargetedDrillDecision,
} from "./trainingOrchestrator";
import type { DecisionRecordStore, ReviewListOptions, ReviewSort } from "./decisionStore";
import type { SpotCandidate, TargetedDrillFilters } from "./spotSelection";
import { selectTargetedSpot } from "./spotSelection";
import { resolveSolverNode } from "./solverResolver";

export interface TrainingApiDeps {
  cache: NodeCache;
  solve: (node: CanonicalNode) => SolverNodeOutput;
  decisionStore: DecisionRecordStore;
  gradeDecision: (output: SolverNodeOutput, userActionId: ActionId) => DecisionGrade;
  seed: string;
  runtimeKey: string;
  recordFactory: RecordFactory;
  configSnapshot: SpotFilters;
  sessionId?: string;
  now?: () => string;
  resolveNextNode?: (
    node: CanonicalNode,
    actionId: ActionId,
    actor: HandPlayActor
  ) => CanonicalNode | null;
}

export interface SpotQuizRequest {
  node: CanonicalNode;
  userActionId: ActionId;
  sessionId?: string;
}

export interface SpotQuizResponse {
  nodeHash: string;
  output: SolverNodeOutput;
  grade: DecisionGrade;
  record: DecisionRecord;
}

export interface HandPlayRequest {
  node: CanonicalNode;
  userActionId: ActionId;
  sequenceIndex: number;
  sessionId?: string;
}

export interface HandPlayResponse {
  nodeHash: string;
  output: SolverNodeOutput;
  grade: DecisionGrade;
  record: DecisionRecord;
  opponentAction?: ActionId;
  opponentNodeHash?: string;
  nextNode?: CanonicalNode | null;
}

export interface TargetedDrillRequest {
  candidates: SpotCandidate[];
  filters: TargetedDrillFilters;
  userActionId: ActionId;
  sequenceIndex?: number;
  sessionId?: string;
}

export interface TargetedDrillResponse {
  spot: SpotCandidate | null;
  nodeHash?: string;
  output?: SolverNodeOutput;
  grade?: DecisionGrade;
  record?: DecisionRecord;
}

export interface ReviewListRequest {
  sessionId?: string;
  modes?: TrainingMode[];
  sort?: ReviewSort;
  offset?: number;
  limit?: number;
}

export interface ReviewListResponse {
  items: DecisionRecord[];
  total: number;
}

export interface ReviewDetailRequest {
  id: string;
  node?: CanonicalNode;
}

export interface ReviewDetailResponse {
  record: DecisionRecord | null;
  output?: SolverNodeOutput;
}

function resolveSessionId(requestSessionId: string | undefined, deps: TrainingApiDeps): string | undefined {
  return requestSessionId ?? deps.sessionId;
}

function requestSnapshot(
  mode: TrainingMode,
  payload: Record<string, unknown>
): DecisionRequestSnapshot {
  return { mode, payload };
}

export function createTrainingApi(deps: TrainingApiDeps) {
  return {
    spotQuiz(request: SpotQuizRequest): SpotQuizResponse {
      const snapshot = requestSnapshot("spot-quiz", {
        node: request.node,
        userActionId: request.userActionId,
      });
      const result = runSpotQuizDecision(request.node, request.userActionId, {
        cache: deps.cache,
        solve: deps.solve,
        decisionStore: deps.decisionStore,
        gradeDecision: deps.gradeDecision,
        seed: deps.seed,
        runtimeKey: deps.runtimeKey,
        recordFactory: deps.recordFactory,
        requestSnapshot: snapshot,
        configSnapshot: deps.configSnapshot,
        sessionId: resolveSessionId(request.sessionId, deps),
        now: deps.now,
      });

      return result;
    },

    handPlayStep(request: HandPlayRequest): HandPlayResponse {
      const snapshot = requestSnapshot("hand-play", {
        node: request.node,
        userActionId: request.userActionId,
        sequenceIndex: request.sequenceIndex,
      });
      return advanceHandPlayStep(
        {
          node: request.node,
          userActionId: request.userActionId,
          sequenceIndex: request.sequenceIndex,
        },
        {
          cache: deps.cache,
          solve: deps.solve,
          decisionStore: deps.decisionStore,
          gradeDecision: deps.gradeDecision,
          seed: deps.seed,
          runtimeKey: deps.runtimeKey,
          recordFactory: deps.recordFactory,
          requestSnapshot: snapshot,
          configSnapshot: deps.configSnapshot,
          sessionId: resolveSessionId(request.sessionId, deps),
          now: deps.now,
          resolveNextNode: deps.resolveNextNode,
        }
      );
    },

    targetedDrill(request: TargetedDrillRequest): TargetedDrillResponse {
      const spot = selectTargetedSpot(
        request.candidates,
        request.filters,
        deps.seed,
        request.sequenceIndex
      );

      if (!spot) {
        return { spot: null };
      }

      const snapshot = requestSnapshot("targeted-drill", {
        candidates: request.candidates,
        filters: request.filters,
        userActionId: request.userActionId,
        sequenceIndex: request.sequenceIndex,
      });
      const result = runTargetedDrillDecision(spot.node, request.userActionId, {
        cache: deps.cache,
        solve: deps.solve,
        decisionStore: deps.decisionStore,
        gradeDecision: deps.gradeDecision,
        seed: deps.seed,
        runtimeKey: deps.runtimeKey,
        recordFactory: deps.recordFactory,
        requestSnapshot: snapshot,
        configSnapshot: deps.configSnapshot,
        sessionId: resolveSessionId(request.sessionId, deps),
        now: deps.now,
      });

      return { spot, ...result };
    },

    reviewList(request: ReviewListRequest = {}): ReviewListResponse {
      const options: ReviewListOptions = {
        sessionId: request.sessionId,
        modes: request.modes,
        sort: request.sort,
        offset: request.offset,
        limit: request.limit,
      };

      const items = deps.decisionStore.list(options);
      return { items, total: items.length };
    },

    reviewDetail(request: ReviewDetailRequest): ReviewDetailResponse {
      const record = deps.decisionStore.get(request.id) ?? null;
      if (!record) return { record: null };

      if (!request.node) {
        return { record };
      }

      const resolved = resolveSolverNode(request.node, {
        cache: deps.cache,
        solve: deps.solve,
      });
      return { record, output: resolved.output };
    },
  };
}
