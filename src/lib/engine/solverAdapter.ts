// src/lib/engine/solverAdapter.ts

import type { ActionId, Position, Street } from "./types";

export interface NodePublicState {
  street: Street;
  potBb: number;
  effectiveStackBb: number;
  board: string[];
  toAct: Position;
}

export interface NodeHistory {
  actions: ActionId[];
}

export interface SolverActionOutput {
  actionId: ActionId;
  frequency: number; // p(a)
  ev: number; // in bb or chips
}

export interface SolverNodeOutput {
  nodeId?: string;
  actions: SolverActionOutput[];
  status: "ok" | "unsolved" | "error";
  units: "bb" | "chips";
  exploitability?: number;
  meta?: {
    provider?: SolverProvider;
    source?: "cache" | "live" | "precomputed" | "fallback";
    nodeHash?: string;
    solveMs?: number;
    solvedAt?: string;
    errorCode?: SolverErrorCodeV2;
    retriable?: boolean;
    errorMessage?: string;
  };
}

export interface SolverRequest {
  gameVersion: string;
  abstractionVersion: string;
  solverVersion: string;
  publicState: NodePublicState;
  history: NodeHistory;
  toAct: Position;
  rangeContext?: string;
}

export type SolverResponse = SolverNodeOutput;

// P1.T2 OpenSpiel-first adapter contract (provider-agnostic).
export type SolverProvider = "openspiel" | "precomputed" | "inhouse";
export type SolverEvUnit = "bb_per_hand";

export interface SolverNodeRequestV2 {
  provider: SolverProvider;
  nodeHash: string;
  context: {
    gameVersion: string;
    abstractionVersion: string;
    solverVersion: string;
    evUnit: SolverEvUnit;
  };
  state: {
    street: "preflop" | "flop" | "turn" | "river";
    board: string[];
    potBb: number;
    effectiveStackBb: number;
    heroPosition: string;
    villainPosition: string;
    toAct: "hero" | "villain";
  };
  actionHistory: Array<{
    actor: "hero" | "villain";
    action: "fold" | "check" | "call" | "bet" | "raise";
    sizeBb?: number;
  }>;
}

export interface SolverActionPolicyV2 {
  actionId: string;
  action: "fold" | "check" | "call" | "bet" | "raise";
  sizeBb?: number;
  frequency: number;
  ev: number;
}

export interface SolverNodeResponseV2 {
  provider: SolverProvider;
  nodeHash: string;
  actions: SolverActionPolicyV2[];
  meta: {
    source: "cache" | "live" | "precomputed" | "fallback";
    solveMs?: number;
    solvedAt?: string;
  };
}

export type SolverErrorCodeV2 =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_NODE"
  | "SOLVER_TIMEOUT"
  | "SOLVER_UNAVAILABLE"
  | "LICENSE_BLOCKED"
  | "INTERNAL_ERROR";

export interface SolverErrorV2 {
  ok: false;
  code: SolverErrorCodeV2;
  message: string;
  provider?: SolverProvider;
  nodeHash?: string;
  retriable: boolean;
}

const FREQ_EPS = 1e-4;

function assertFiniteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

export function normalizeSolverActionPolicies(
  actions: SolverActionPolicyV2[],
  eps = 1e-9
): SolverActionPolicyV2[] {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("actions must be a non-empty array");
  }

  const normalized = actions.map((a, i) => {
    if (a === null || typeof a !== "object") {
      throw new Error(`actions[${i}] must be an object`);
    }
    if (typeof a.actionId !== "string" || a.actionId.length === 0) {
      throw new Error(`actions[${i}].actionId must be a non-empty string`);
    }
    assertFiniteNumber(a.frequency, `actions[${i}].frequency`);
    assertFiniteNumber(a.ev, `actions[${i}].ev`);
    if (a.frequency < 0) {
      throw new Error(`actions[${i}].frequency must be >= 0`);
    }
    return { ...a };
  });

  const sum = normalized.reduce((acc, a) => acc + a.frequency, 0);
  if (sum <= eps) {
    throw new Error("frequency sum must be > 0");
  }

  const renormalized = normalized
    .map((a) => ({ ...a, frequency: a.frequency / sum }))
    .sort((a, b) => a.actionId.localeCompare(b.actionId));

  const post = renormalized.reduce((acc, a) => acc + a.frequency, 0);
  if (Math.abs(post - 1) > eps * 10) {
    throw new Error(`normalized frequency sum must be ~1.0 (got ${post})`);
  }

  return renormalized;
}

export function validateSolverNodeOutput(output: unknown): SolverNodeOutput {
  if (output === null || typeof output !== "object") {
    throw new Error("solver output must be an object");
  }

  const o = output as Partial<SolverNodeOutput>;

  if (o.units !== "bb" && o.units !== "chips") {
    throw new Error("solver output units must be 'bb' or 'chips'");
  }

  if (o.status !== "ok" && o.status !== "unsolved" && o.status !== "error") {
    throw new Error("solver output status must be 'ok', 'unsolved', or 'error'");
  }

  if (!Array.isArray(o.actions)) {
    throw new Error("solver output actions must be an array");
  }

  if (o.nodeId !== undefined && (typeof o.nodeId !== "string" || o.nodeId.length === 0)) {
    throw new Error("solver output nodeId must be a non-empty string if provided");
  }

  if (o.exploitability !== undefined) {
    assertFiniteNumber(o.exploitability, "exploitability");
  }

  if (o.meta !== undefined) {
    if (o.meta === null || typeof o.meta !== "object") {
      throw new Error("solver output meta must be an object if provided");
    }
    if (
      o.meta.provider !== undefined &&
      o.meta.provider !== "openspiel" &&
      o.meta.provider !== "precomputed" &&
      o.meta.provider !== "inhouse"
    ) {
      throw new Error("solver output meta.provider must be a supported provider");
    }
    if (
      o.meta.source !== undefined &&
      o.meta.source !== "cache" &&
      o.meta.source !== "live" &&
      o.meta.source !== "precomputed" &&
      o.meta.source !== "fallback"
    ) {
      throw new Error("solver output meta.source must be a supported source");
    }
    if (o.meta.nodeHash !== undefined && (typeof o.meta.nodeHash !== "string" || o.meta.nodeHash.length === 0)) {
      throw new Error("solver output meta.nodeHash must be a non-empty string if provided");
    }
    if (o.meta.solveMs !== undefined) {
      assertFiniteNumber(o.meta.solveMs, "meta.solveMs");
      if (o.meta.solveMs < 0) {
        throw new Error("solver output meta.solveMs must be >= 0");
      }
    }
    if (o.meta.solvedAt !== undefined && (typeof o.meta.solvedAt !== "string" || o.meta.solvedAt.length === 0)) {
      throw new Error("solver output meta.solvedAt must be a non-empty string if provided");
    }
    if (
      o.meta.errorCode !== undefined &&
      o.meta.errorCode !== "INVALID_REQUEST" &&
      o.meta.errorCode !== "UNSUPPORTED_NODE" &&
      o.meta.errorCode !== "SOLVER_TIMEOUT" &&
      o.meta.errorCode !== "SOLVER_UNAVAILABLE" &&
      o.meta.errorCode !== "LICENSE_BLOCKED" &&
      o.meta.errorCode !== "INTERNAL_ERROR"
    ) {
      throw new Error("solver output meta.errorCode must be a supported code");
    }
    if (o.meta.retriable !== undefined && typeof o.meta.retriable !== "boolean") {
      throw new Error("solver output meta.retriable must be boolean if provided");
    }
    if (
      o.meta.errorMessage !== undefined &&
      (typeof o.meta.errorMessage !== "string" || o.meta.errorMessage.length === 0)
    ) {
      throw new Error("solver output meta.errorMessage must be a non-empty string if provided");
    }
  }

  if (o.status === "ok" && o.actions.length === 0) {
    throw new Error("solver output status 'ok' must include actions");
  }

  let freqSum = 0;
  const seenIds = new Set<string>();

  for (let i = 0; i < o.actions.length; i++) {
    const action = o.actions[i] as Partial<SolverActionOutput>;

    if (action === null || typeof action !== "object") {
      throw new Error(`actions[${i}] must be an object`);
    }
    if (typeof action.actionId !== "string" || action.actionId.length === 0) {
      throw new Error(`actions[${i}].actionId must be a non-empty string`);
    }
    if (seenIds.has(action.actionId)) {
      throw new Error(`duplicate actionId '${action.actionId}'`);
    }
    seenIds.add(action.actionId);

    assertFiniteNumber(action.frequency, `actions[${i}].frequency`);
    assertFiniteNumber(action.ev, `actions[${i}].ev`);

    if (action.frequency < -FREQ_EPS || action.frequency > 1 + FREQ_EPS) {
      throw new Error(`actions[${i}].frequency must be between 0 and 1`);
    }

    freqSum += action.frequency;
  }

  if (o.status === "ok" && Math.abs(freqSum - 1) > FREQ_EPS) {
    throw new Error(`frequency sum must be ~1.0 (got ${freqSum})`);
  }

  return o as SolverNodeOutput;
}
