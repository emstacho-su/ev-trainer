// src/lib/runtime/runtimeRegistry.ts

import type { Runtime } from "./createRuntime";
import { createRuntime } from "./createRuntime";
import { runtimeKeyFrom } from "./runtimeKey";

const BASE_TIME_MS = Date.parse("2026-01-01T00:00:00.000Z");

interface RuntimeEntry {
  runtime: Runtime;
}

const registry = new Map<string, RuntimeEntry>();

function createDeterministicNow(): () => string {
  let counter = 0;
  return () => {
    const timestamp = new Date(BASE_TIME_MS + counter * 1000).toISOString();
    counter += 1;
    return timestamp;
  };
}

export function getRuntime(seed: string, sessionId: string): Runtime {
  const key = runtimeKeyFrom(seed, sessionId);
  const existing = registry.get(key);
  if (existing) return existing.runtime;

  const now = createDeterministicNow();
  const runtime = createRuntime({
    seed,
    sessionId,
    now,
  });

  registry.set(key, { runtime });
  return runtime;
}

export function clearRuntimeRegistry(): void {
  registry.clear();
}
