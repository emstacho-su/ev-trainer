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
 */
function deriveScenarioKey(request: SolverRequest): string | null {
  const position = request.toAct;
  const history = request.history.actions;

  if (history.length === 0) return `${position}_RFI`;

  const raiseCount = history.filter(
    (a) => a.startsWith("RAISE") || a.startsWith("BET")
  ).length;

  if (raiseCount === 1 && history.length === 1) {
    return `${position}_vs_RAISE`;
  }
  if (raiseCount === 2 && history.length === 2) {
    return `${position}_vs_3BET`;
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

      let database: RangeDatabase;
      if (isServer) {
        const { readFileSync } = await import("node:fs");
        const { resolve } = await import("node:path");
        const filePath = resolve(process.cwd(), "public/ranges/preflop-6max-100bb.json");
        const raw = readFileSync(filePath, "utf-8");
        database = JSON.parse(raw);
      } else {
        const response = await fetch("/ranges/preflop-6max-100bb.json");
        database = await response.json();
      }

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
