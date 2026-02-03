/**
 * Overview: In-memory deterministic session progression registry.
 * Interacts with: session handlers via create/get/advance lifecycle methods.
 * Importance: Controls decision index and completion state per seeded session.
 */

// In-memory registry for v2 sessions. Non-durable and not serverless-safe.

import { runtimeKeyFrom } from "./runtimeKey";

export interface V2SessionState {
  sessionId: string;
  seed: string;
  decisionIndex: number;
  decisionsPerSession: number;
}

export interface V2SessionSnapshot extends V2SessionState {
  isComplete: boolean;
}

interface RegistryEntry {
  state: V2SessionState;
}

export interface V2SessionRegistryBackend {
  get(key: string): { state: V2SessionState } | undefined;
  set(key: string, value: { state: V2SessionState }): void;
  clear(): void;
}

class InMemoryV2SessionRegistryBackend implements V2SessionRegistryBackend {
  private readonly registry = new Map<string, RegistryEntry>();

  get(key: string): RegistryEntry | undefined {
    return this.registry.get(key);
  }

  set(key: string, value: RegistryEntry): void {
    this.registry.set(key, value);
  }

  clear(): void {
    this.registry.clear();
  }
}

let backend: V2SessionRegistryBackend = new InMemoryV2SessionRegistryBackend();
const DEFAULT_DECISIONS_PER_SESSION = 10;

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertPositiveInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function snapshot(state: V2SessionState): V2SessionSnapshot {
  return {
    ...state,
    isComplete: state.decisionIndex >= state.decisionsPerSession,
  };
}

export function createSession(input: {
  sessionId: string;
  seed: string;
  decisionsPerSession?: number;
}): V2SessionSnapshot {
  assertNonEmptyString(input.sessionId, "sessionId");
  assertNonEmptyString(input.seed, "seed");

  const decisionsPerSession =
    input.decisionsPerSession ?? DEFAULT_DECISIONS_PER_SESSION;
  assertPositiveInteger(decisionsPerSession, "decisionsPerSession");

  const key = runtimeKeyFrom(input.seed, input.sessionId);
  const existing = backend.get(key);
  if (existing) {
    return snapshot(existing.state);
  }

  const state: V2SessionState = {
    sessionId: input.sessionId,
    seed: input.seed,
    decisionIndex: 0,
    decisionsPerSession,
  };
  backend.set(key, { state });
  return snapshot(state);
}

export function getSession(sessionId: string, seed: string): V2SessionSnapshot | null {
  const key = runtimeKeyFrom(seed, sessionId);
  const entry = backend.get(key);
  return entry ? snapshot(entry.state) : null;
}

export function advanceSession(sessionId: string, seed: string): V2SessionSnapshot {
  assertNonEmptyString(sessionId, "sessionId");
  assertNonEmptyString(seed, "seed");
  const key = runtimeKeyFrom(seed, sessionId);
  const entry = backend.get(key);
  if (!entry) {
    throw new Error("session not found");
  }

  const state = entry.state;
  if (state.decisionIndex >= state.decisionsPerSession) {
    throw new Error("session complete");
  }
  state.decisionIndex += 1;
  return snapshot(state);
}

export function clearSessionRegistry(): void {
  backend.clear();
}

export function getDefaultDecisionsPerSession(): number {
  return DEFAULT_DECISIONS_PER_SESSION;
}

export function setV2SessionRegistryBackend(nextBackend: V2SessionRegistryBackend): void {
  backend = nextBackend;
}
