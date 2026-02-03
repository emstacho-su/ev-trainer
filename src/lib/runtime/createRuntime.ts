// src/lib/runtime/createRuntime.ts

import type { SpotFilters } from "../engine/filters";
import { validateSpotFilters } from "../engine/filters";
import { MemoryDecisionStore } from "../engine/decisionStore";
import { MemoryNodeCache } from "../engine/nodeCache";
import { createTrainingApi } from "../engine/trainingApi";
import type { CanonicalNode } from "../engine/nodeTypes";
import type { SolverNodeOutput, SolverProvider } from "../engine/solverAdapter";
import { mockSolve } from "../engine/mockSolver";
import { openSpielSolve } from "../engine/openSpielSolver";
import { assertCommercialSolverPolicy } from "../engine/solverPolicy";
import type { Evaluator } from "../engine/evaluator";
import { gradeDecision } from "./gradeDecision";
import { runtimeKeyFrom } from "./runtimeKey";

export interface RuntimeConfig {
  seed: string;
  sessionId: string;
  now?: () => string;
  configSnapshot?: SpotFilters;
  solve?: (node: CanonicalNode) => SolverNodeOutput;
  evaluator?: Evaluator;
  cacheSize?: number;
  solverProvider?: SolverProvider;
  legalApproved?: boolean;
}

export interface Runtime {
  cache: MemoryNodeCache;
  decisionStore: MemoryDecisionStore;
  trainingApi: ReturnType<typeof createTrainingApi>;
  solve: (node: CanonicalNode) => SolverNodeOutput;
  evaluator: Evaluator;
  gradeDecision: typeof gradeDecision;
  config: {
    seed: string;
    sessionId: string;
    now?: () => string;
    configSnapshot: SpotFilters;
    cacheSize: number;
  };
  counters: {
    createdSeq: number;
    recordIdSeq: number;
  };
  runtimeKey: string;
}

function assertSeed(seed: string): void {
  if (typeof seed !== "string" || seed.length === 0) {
    throw new Error("seed must be a non-empty string");
  }
}

function assertSessionId(sessionId: string): void {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error("sessionId must be a non-empty string");
  }
}

function createDeterministicNow(): () => string {
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  let counter = 0;
  return () => {
    const timestamp = new Date(base + counter * 1000).toISOString();
    counter += 1;
    return timestamp;
  };
}

export function demoSolve(node: CanonicalNode): SolverNodeOutput {
  return mockSolve(node);
}

export function createRuntime(config: RuntimeConfig): Runtime {
  assertSeed(config.seed);
  assertSessionId(config.sessionId);
  const cacheSize = config.cacheSize ?? 500;
  if (!Number.isInteger(cacheSize) || cacheSize <= 0) {
    throw new Error("cacheSize must be a positive integer");
  }

  const solverProvider = config.solverProvider ?? "openspiel";
  assertCommercialSolverPolicy(solverProvider, { legalApproved: config.legalApproved });

  const configSnapshot = validateSpotFilters(config.configSnapshot ?? {});
  const cache = new MemoryNodeCache(cacheSize);
  const decisionStore = new MemoryDecisionStore();
  const defaultSolve =
    solverProvider === "openspiel" ? openSpielSolve : (node: CanonicalNode) => mockSolve(node);

  const evaluator =
    config.evaluator ??
    (config.solve
      ? { evaluate: ({ node }: { node: CanonicalNode }) => config.solve!(node) }
      : { evaluate: ({ node }: { node: CanonicalNode }) => defaultSolve(node) });

  const solve = config.solve ?? ((node: CanonicalNode) => evaluator.evaluate({ node }));
  const now = config.now ?? createDeterministicNow();
  const runtimeKey = runtimeKeyFrom(config.seed, config.sessionId);
  const counters = {
    createdSeq: 0,
    recordIdSeq: 0,
  };
  const recordFactory = () => {
    counters.createdSeq += 1;
    counters.recordIdSeq += 1;
    const recordId = `rec_${counters.recordIdSeq.toString(36).padStart(6, "0")}`;
    return { recordId, createdSeq: counters.createdSeq };
  };

  const trainingApi = createTrainingApi({
    cache,
    solve,
    decisionStore,
    gradeDecision,
    seed: config.seed,
    runtimeKey,
    recordFactory,
    configSnapshot,
    sessionId: config.sessionId,
    now,
  });

  return {
    cache,
    decisionStore,
    trainingApi,
    solve,
    evaluator,
    gradeDecision,
    config: {
      seed: config.seed,
      sessionId: config.sessionId,
      now,
      configSnapshot,
      cacheSize,
    },
    counters,
    runtimeKey,
  };
}
