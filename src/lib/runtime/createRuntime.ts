// src/lib/runtime/createRuntime.ts

import type { SpotFilters } from "../engine/filters";
import { validateSpotFilters } from "../engine/filters";
import { MemoryDecisionStore } from "../engine/decisionStore";
import { CompositeNodeCache, FileNodeCache, MemoryNodeCache, type NodeCache } from "../engine/nodeCache";
import { createTrainingApi } from "../engine/trainingApi";
import type { CanonicalNode } from "../engine/nodeTypes";
import type { SolverNodeOutput, SolverProvider } from "../engine/solverAdapter";
import { mockSolve } from "../engine/mockSolver";
import {
  openSpielSolve,
  type OpenSpielIntegrationMode,
  type OpenSpielTransport,
} from "../engine/openSpielSolver";
import { createOpenSpielServiceTransport } from "../engine/openSpielServiceTransport";
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
  openSpielMode?: OpenSpielIntegrationMode;
  openSpielTimeoutMs?: number;
  openSpielTransport?: OpenSpielTransport;
  openSpielPersistentCachePath?: string;
  openSpielPersistentMaxEntries?: number;
  openSpielBridgeCommand?: string;
  openSpielBridgeArgs?: string[];
  openSpielServiceUrl?: string;
}

export interface Runtime {
  cache: NodeCache;
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

function createNodeCache(config: RuntimeConfig, solverProvider: SolverProvider, cacheSize: number): NodeCache {
  const memory = new MemoryNodeCache(cacheSize);
  if (solverProvider !== "openspiel" || !config.openSpielPersistentCachePath) {
    return memory;
  }
  const persistent = new FileNodeCache(
    config.openSpielPersistentCachePath,
    config.openSpielPersistentMaxEntries ?? 5000
  );
  return new CompositeNodeCache(memory, persistent);
}

function createOpenSpielTransport(config: RuntimeConfig): OpenSpielTransport | undefined {
  if (config.openSpielTransport) return config.openSpielTransport;
  const command = config.openSpielBridgeCommand ?? process.env.OPENSPIEL_BRIDGE_COMMAND;
  if (!command) return undefined;
  const args = config.openSpielBridgeArgs ?? process.env.OPENSPIEL_BRIDGE_ARGS?.split(" ").filter(Boolean) ?? [];
  const env = config.openSpielServiceUrl
    ? { ...process.env, OPENSPIEL_SERVICE_URL: config.openSpielServiceUrl }
    : undefined;
  return createOpenSpielServiceTransport({
    command,
    args,
    env,
  });
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
  const cache = createNodeCache(config, solverProvider, cacheSize);
  const decisionStore = new MemoryDecisionStore();
  const openSpielTransport = createOpenSpielTransport(config);
  const defaultSolve =
    solverProvider === "openspiel"
      ? (node: CanonicalNode) =>
          openSpielSolve(node, {
            mode: config.openSpielMode,
            timeoutMs: config.openSpielTimeoutMs,
            now: config.now,
            transport: openSpielTransport,
          })
      : (node: CanonicalNode) => mockSolve(node);

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
