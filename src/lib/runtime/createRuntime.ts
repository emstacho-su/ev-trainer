// src/lib/runtime/createRuntime.ts

import type { SpotFilters } from "../engine/filters";
import { validateSpotFilters } from "../engine/filters";
import { MemoryDecisionStore } from "../engine/decisionStore";
import { MemoryNodeCache } from "../engine/nodeCache";
import { createTrainingApi } from "../engine/trainingApi";
import type { CanonicalNode } from "../engine/nodeTypes";
import type { SolverNodeOutput } from "../engine/solverAdapter";
import { mockSolve } from "../engine/mockSolver";
import { gradeDecision } from "./gradeDecision";

export interface RuntimeConfig {
  seed: string;
  sessionId?: string;
  now?: () => string;
  idFactory?: () => string;
  configSnapshot?: SpotFilters;
  solve?: (node: CanonicalNode) => SolverNodeOutput;
  cacheSize?: number;
}

export interface Runtime {
  cache: MemoryNodeCache;
  decisionStore: MemoryDecisionStore;
  trainingApi: ReturnType<typeof createTrainingApi>;
  solve: (node: CanonicalNode) => SolverNodeOutput;
  gradeDecision: typeof gradeDecision;
  config: {
    seed: string;
    sessionId?: string;
    now?: () => string;
    idFactory?: () => string;
    configSnapshot: SpotFilters;
    cacheSize: number;
  };
}

function assertSeed(seed: string): void {
  if (typeof seed !== "string" || seed.length === 0) {
    throw new Error("seed must be a non-empty string");
  }
}

export function demoSolve(node: CanonicalNode): SolverNodeOutput {
  return mockSolve(node);
}

export function createRuntime(config: RuntimeConfig): Runtime {
  assertSeed(config.seed);
  const cacheSize = config.cacheSize ?? 500;
  if (!Number.isInteger(cacheSize) || cacheSize <= 0) {
    throw new Error("cacheSize must be a positive integer");
  }

  const configSnapshot = validateSpotFilters(config.configSnapshot ?? {});
  const cache = new MemoryNodeCache(cacheSize);
  const decisionStore = new MemoryDecisionStore();
  const solve = config.solve ?? demoSolve;

  const trainingApi = createTrainingApi({
    cache,
    solve,
    decisionStore,
    gradeDecision,
    seed: config.seed,
    configSnapshot,
    sessionId: config.sessionId,
    now: config.now,
    idFactory: config.idFactory,
  });

  return {
    cache,
    decisionStore,
    trainingApi,
    solve,
    gradeDecision,
    config: {
      seed: config.seed,
      sessionId: config.sessionId,
      now: config.now,
      idFactory: config.idFactory,
      configSnapshot,
      cacheSize,
    },
  };
}
