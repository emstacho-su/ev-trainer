// src/lib/engine/spotSource.ts

import type { SpotCandidate, TargetedDrillFilters } from "./spotSelection";
import { selectTargetedSpot } from "./spotSelection";

// Abstraction for supplying spots to training flows.
export interface SpotSource {
  list(): SpotCandidate[];
  select(filters: TargetedDrillFilters, seed?: string, sequenceIndex?: number): SpotCandidate | null;
}

// In-memory SpotSource for tests and local development.
export class InMemorySpotSource implements SpotSource {
  private readonly candidates: SpotCandidate[];

  constructor(candidates: SpotCandidate[]) {
    if (!Array.isArray(candidates)) {
      throw new Error("candidates must be an array");
    }
    this.candidates = candidates;
  }

  list(): SpotCandidate[] {
    return [...this.candidates];
  }

  select(
    filters: TargetedDrillFilters,
    seed?: string,
    sequenceIndex?: number
  ): SpotCandidate | null {
    return selectTargetedSpot(this.candidates, filters, seed, sequenceIndex);
  }
}
