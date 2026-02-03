// src/lib/engine/trainingOrchestrator.ts

import type { SpotFilters } from "./filters";
import type { NodeCache } from "./nodeCache";
import type { CanonicalNode } from "./nodeTypes";
import type { ActionId } from "./types";
import type { SolverNodeOutput } from "./solverAdapter";
import { resolveSolverNode } from "./solverResolver";
import { sampleOpponentAction } from "./opponentPolicy";

export type TrainingMode = "spot-quiz" | "hand-play" | "review" | "targeted-drill";

export interface DecisionGrade {
  evUser: number;
  evMix: number;
  evBest: number;
  evLossVsMix: number;
  evLossVsBest: number;
  pureMistake: boolean;
  policyDivergence: number;
  isBestAction: boolean;
  gradeLabel?: string;
}

export interface DecisionMetrics {
  evUser: number;
  evMix: number;
  evBest: number;
  evLossVsMix: number;
  evLossVsBest: number;
}

export interface DecisionRequestSnapshot {
  mode: TrainingMode;
  payload: Record<string, unknown>;
}

export interface DecisionRecord {
  recordId: string;
  createdSeq: number;
  runtimeKey: string;
  id: string;
  request: DecisionRequestSnapshot;
  metrics: DecisionMetrics;
  nodeHash: string;
  sessionId?: string;
  mode: TrainingMode;
  userActionId: ActionId;
  grade: DecisionGrade;
  configSnapshot: SpotFilters;
  seed: string;
  createdAt: string;
}

export interface DecisionStore {
  add(record: DecisionRecord): void;
}

export type GradeDecision = (output: SolverNodeOutput, userActionId: ActionId) => DecisionGrade;

export type RecordFactory = () => { recordId: string; createdSeq: number };

export interface SpotQuizDeps {
  cache: NodeCache;
  solve: (node: CanonicalNode) => SolverNodeOutput;
  decisionStore: DecisionStore;
  gradeDecision: GradeDecision;
  seed: string;
  runtimeKey: string;
  recordFactory: RecordFactory;
  requestSnapshot: DecisionRequestSnapshot;
  configSnapshot: SpotFilters;
  sessionId?: string;
  now?: () => string;
}

export interface SpotQuizResult {
  nodeHash: string;
  output: SolverNodeOutput;
  grade: DecisionGrade;
  record: DecisionRecord;
}

function metricsFromGrade(grade: DecisionGrade): DecisionMetrics {
  return {
    evUser: grade.evUser,
    evMix: grade.evMix,
    evBest: grade.evBest,
    evLossVsMix: grade.evLossVsMix,
    evLossVsBest: grade.evLossVsBest,
  };
}

function buildDecisionRecord(
  input: Omit<DecisionRecord, "createdAt">,
  deps: { now?: () => string }
): DecisionRecord {
  if (!deps.now) {
    throw new Error("now must be provided to build deterministic decision records");
  }
  const createdAt = deps.now();
  return { ...input, createdAt };
}

export function runSpotQuizDecision(
  node: CanonicalNode,
  userActionId: ActionId,
  deps: SpotQuizDeps
): SpotQuizResult {
  const { nodeHash, output } = resolveSolverNode(node, deps);
  const grade = deps.gradeDecision(output, userActionId);
  const metrics = metricsFromGrade(grade);
  const { recordId, createdSeq } = deps.recordFactory();
  const record = buildDecisionRecord(
    {
      recordId,
      createdSeq,
      runtimeKey: deps.runtimeKey,
      request: deps.requestSnapshot,
      metrics,
      id: recordId,
      nodeHash,
      sessionId: deps.sessionId,
      mode: "spot-quiz",
      userActionId,
      grade,
      configSnapshot: deps.configSnapshot,
      seed: deps.seed,
    },
    { now: deps.now }
  );

  deps.decisionStore.add(record);

  return { nodeHash, output, grade, record };
}

export function runTargetedDrillDecision(
  node: CanonicalNode,
  userActionId: ActionId,
  deps: SpotQuizDeps
): SpotQuizResult {
  const { nodeHash, output } = resolveSolverNode(node, deps);
  const grade = deps.gradeDecision(output, userActionId);
  const metrics = metricsFromGrade(grade);
  const { recordId, createdSeq } = deps.recordFactory();
  const record = buildDecisionRecord(
    {
      recordId,
      createdSeq,
      runtimeKey: deps.runtimeKey,
      request: deps.requestSnapshot,
      metrics,
      id: recordId,
      nodeHash,
      sessionId: deps.sessionId,
      mode: "targeted-drill",
      userActionId,
      grade,
      configSnapshot: deps.configSnapshot,
      seed: deps.seed,
    },
    { now: deps.now }
  );

  deps.decisionStore.add(record);

  return { nodeHash, output, grade, record };
}

export type HandPlayActor = "user" | "opponent";

export interface HandPlayAdvanceDeps {
  cache: NodeCache;
  solve: (node: CanonicalNode) => SolverNodeOutput;
  decisionStore: DecisionStore;
  gradeDecision: GradeDecision;
  seed: string;
  runtimeKey: string;
  recordFactory: RecordFactory;
  requestSnapshot: DecisionRequestSnapshot;
  configSnapshot: SpotFilters;
  sessionId?: string;
  now?: () => string;
  resolveNextNode?: (
    node: CanonicalNode,
    actionId: ActionId,
    actor: HandPlayActor
  ) => CanonicalNode | null;
}

export interface HandPlayStepInput {
  node: CanonicalNode;
  userActionId: ActionId;
  sequenceIndex: number;
}

export interface HandPlayStepResult {
  nodeHash: string;
  output: SolverNodeOutput;
  grade: DecisionGrade;
  record: DecisionRecord;
  opponentAction?: ActionId;
  opponentNodeHash?: string;
  nextNode?: CanonicalNode | null;
}

export function advanceHandPlayStep(
  input: HandPlayStepInput,
  deps: HandPlayAdvanceDeps
): HandPlayStepResult {
  const { nodeHash, output } = resolveSolverNode(input.node, deps);
  const grade = deps.gradeDecision(output, input.userActionId);
  const metrics = metricsFromGrade(grade);
  const { recordId, createdSeq } = deps.recordFactory();
  const record = buildDecisionRecord(
    {
      recordId,
      createdSeq,
      runtimeKey: deps.runtimeKey,
      request: deps.requestSnapshot,
      metrics,
      id: recordId,
      nodeHash,
      sessionId: deps.sessionId,
      mode: "hand-play",
      userActionId: input.userActionId,
      grade,
      configSnapshot: deps.configSnapshot,
      seed: deps.seed,
    },
    { now: deps.now }
  );

  deps.decisionStore.add(record);

  if (!deps.resolveNextNode) {
    return { nodeHash, output, grade, record };
  }

  const opponentNode = deps.resolveNextNode(input.node, input.userActionId, "user");
  if (!opponentNode) {
    return { nodeHash, output, grade, record, nextNode: null };
  }

  const opponentResolved = resolveSolverNode(opponentNode, deps);
  if (opponentResolved.output.status !== "ok") {
    throw new Error("opponent node must have solver status 'ok' to sample");
  }

  const opponentSample = sampleOpponentAction(
    { base: opponentResolved.output.actions },
    {
      nodeHash: opponentResolved.nodeHash,
      sequenceIndex: input.sequenceIndex,
      seed: deps.seed,
    }
  );

  const nextNode = deps.resolveNextNode(
    opponentNode,
    opponentSample.action.actionId,
    "opponent"
  );

  return {
    nodeHash,
    output,
    grade,
    record,
    opponentAction: opponentSample.action.actionId,
    opponentNodeHash: opponentResolved.nodeHash,
    nextNode,
  };
}
