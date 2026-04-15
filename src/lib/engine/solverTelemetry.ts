// src/lib/engine/solverTelemetry.ts
// Records solver routing events so silent fallbacks don't hide real bugs.
//
// The PostflopSolverAdapter falls back to the mock solver when WASM is
// unavailable (server-side) OR when the WASM call throws. The server-side
// case is expected; the throw case is a bug surface that previously got
// swallowed. This module records both so we can diagnose issues in dev and
// prove in tests that we actually hit the WASM path when expected.

export type SolverPath = "wasm" | "mock-fallback-unavailable" | "mock-fallback-failed";

export interface SolverRoutingEvent {
  readonly path: SolverPath;
  readonly street: string;
  readonly timestamp: number;
  readonly error?: string;
}

const listeners = new Set<(event: SolverRoutingEvent) => void>();
const history: SolverRoutingEvent[] = [];
const MAX_HISTORY = 100;

/**
 * Record a solver routing decision. Called by PostflopSolverAdapter.
 * In dev mode, a failed WASM fallback logs a prominent warning.
 */
export function recordSolverEvent(event: Omit<SolverRoutingEvent, "timestamp">): void {
  const full: SolverRoutingEvent = { ...event, timestamp: Date.now() };
  history.push(full);
  if (history.length > MAX_HISTORY) history.shift();

  // Dev-mode visibility: a WASM-intended-but-failed fallback is a bug surface.
  if (event.path === "mock-fallback-failed") {
    const msg = `[SolverTelemetry] WASM solve failed -> fell back to mock. Street=${event.street}. Error=${event.error ?? "<none>"}`;
    if (process.env.NODE_ENV !== "production") {
      console.warn(msg);
    }
    if (process.env.EV_TRAINER_STRICT_SOLVER === "1") {
      throw new Error(msg);
    }
  }

  for (const listener of listeners) {
    try {
      listener(full);
    } catch {
      // Never let a listener take down the solver pipeline.
    }
  }
}

/** Subscribe to routing events. Returns an unsubscribe fn. */
export function onSolverEvent(fn: (event: SolverRoutingEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Snapshot recent routing events (most-recent last). Test-friendly. */
export function getSolverHistory(): readonly SolverRoutingEvent[] {
  return [...history];
}

/** Clear the routing history. Useful between tests. */
export function resetSolverTelemetry(): void {
  history.length = 0;
}
