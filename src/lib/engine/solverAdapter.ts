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

const FREQ_EPS = 1e-4;

function assertFiniteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
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
