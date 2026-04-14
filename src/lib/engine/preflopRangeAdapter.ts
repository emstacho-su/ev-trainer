// src/lib/engine/preflopRangeAdapter.ts
// Serves precomputed preflop ranges through the AsyncSolverAdapter interface.
// Loads from public/ranges/preflop-6max-100bb.json (bundled, no DB dependency).

import type { SolverNodeOutput, SolverRequest } from "./solverAdapter";
import type { AsyncSolverAdapter } from "./solverTypes";

interface RangeDatabase {
  schemaVersion: string;
  scenarios: Record<string, SolverNodeOutput>;
}

/**
 * Derive a scenario key from a solver request.
 * Maps publicState (position, history) to a scenario identifier matching the range database.
 *
 * Supports: RFI, vs_RAISE, vs_3BET, vs_4BET, BB defense by opener, SB vs BB, BB vs SB limp.
 */
function deriveScenarioKey(request: SolverRequest): string | null {
  const position = request.toAct;
  const history = request.history.actions;

  // RFI — no prior aggression (only folds before us)
  if (history.length === 0 || history.every((a) => a === "FOLD")) {
    return `${position}_RFI`;
  }

  const raiseCount = history.filter(
    (a) => a.startsWith("RAISE") || a.startsWith("BET"),
  ).length;
  const callCount = history.filter((a) => a === "CALL").length;

  // Facing a single open (1 raise, possibly folds before)
  if (raiseCount === 1 && callCount === 0) {
    return `${position}_vs_RAISE`;
  }

  // Facing a 3-bet (2 raises in history)
  if (raiseCount === 2) {
    return `${position}_vs_3BET`;
  }

  // Facing a 4-bet (3 raises in history)
  if (raiseCount === 3) {
    return `${position}_vs_4BET`;
  }

  // BB facing SB limp (SB completed, no raise)
  if (position === "BB" && callCount >= 1 && raiseCount === 0) {
    return "BB_vs_SB_LIMP";
  }

  return null;
}

/**
 * PreflopRangeAdapter loads precomputed GTO ranges and returns them as SolverNodeOutput.
 * Instant response (no computation) -- ranges are pre-solved.
 */
export class PreflopRangeAdapter implements AsyncSolverAdapter {
  private ranges: Map<string, SolverNodeOutput> = new Map();
  private loaded = false;

  /**
   * Load ranges from the bundled JSON file.
   * Call once during app initialization.
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      // In server context, fetch from filesystem
      // In client context, fetch from public URL
      const isServer = typeof window === "undefined";

      // Always use fetch — this adapter is called from client hooks.
      // On server, construct absolute URL; on client, relative URL works.
      const baseUrl = isServer
        ? `http://localhost:${process.env.PORT || 3000}`
        : "";
      const response = await fetch(`${baseUrl}/ranges/preflop-6max-100bb.json`);
      const database: RangeDatabase = await response.json();

      for (const [key, output] of Object.entries(database.scenarios)) {
        this.ranges.set(key, output as SolverNodeOutput);
      }

      this.loaded = true;
    } catch {
      // Ranges not available -- solve() will return "unsolved"
    }
  }

  /**
   * Return precomputed solver output for a preflop scenario.
   * Returns { status: "unsolved" } if no range data exists for this scenario.
   */
  async solve(request: SolverRequest): Promise<SolverNodeOutput> {
    if (!this.loaded) {
      await this.load();
    }

    const key = deriveScenarioKey(request);
    if (!key) {
      return { status: "unsolved", units: "bb", actions: [] };
    }

    const cached = this.ranges.get(key);
    if (!cached) {
      return { status: "unsolved", units: "bb", actions: [] };
    }

    return cached;
  }
}
