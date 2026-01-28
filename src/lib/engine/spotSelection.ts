// src/lib/engine/spotSelection.ts

import type { Street } from "./types";
import type { CanonicalNode, ActionAbstraction } from "./nodeTypes";
import { buildCanonicalNodeHash } from "./canonicalHash";
import { combineSeed, createSeededRng } from "./rng";

export interface TargetedDrillFilters {
  streets?: Street[];
  boardBuckets?: string[];
  treeRestrictions?: Partial<ActionAbstraction>;
}

export interface SpotCandidate {
  node: CanonicalNode;
  boardBucket?: string;
}

function isSubset(values: number[], allowed: number[]): boolean {
  for (const value of values) {
    if (!allowed.includes(value)) return false;
  }
  return true;
}

function matchesTreeRestrictions(
  abstraction: ActionAbstraction,
  restrictions?: Partial<ActionAbstraction>
): boolean {
  if (!restrictions) return true;
  if (
    restrictions.maxRaisesPerStreet !== undefined &&
    abstraction.maxRaisesPerStreet > restrictions.maxRaisesPerStreet
  ) {
    return false;
  }
  if (restrictions.betSizesBb && !isSubset(abstraction.betSizesBb, restrictions.betSizesBb)) {
    return false;
  }
  if (restrictions.raiseSizesBb && !isSubset(abstraction.raiseSizesBb, restrictions.raiseSizesBb)) {
    return false;
  }
  return true;
}

export function filterTargetedSpots(
  candidates: SpotCandidate[],
  filters: TargetedDrillFilters
): SpotCandidate[] {
  return candidates.filter((candidate) => {
    if (filters.streets && filters.streets.length > 0) {
      if (!filters.streets.includes(candidate.node.publicState.street)) return false;
    }
    if (filters.boardBuckets && filters.boardBuckets.length > 0) {
      if (!candidate.boardBucket) return false;
      if (!filters.boardBuckets.includes(candidate.boardBucket)) return false;
    }
    if (!matchesTreeRestrictions(candidate.node.abstraction, filters.treeRestrictions)) {
      return false;
    }
    return true;
  });
}

/**
 * Deterministic spot selection. Varies by sequenceIndex when provided.
 */
export function selectTargetedSpot(
  candidates: SpotCandidate[],
  filters: TargetedDrillFilters,
  seed?: string,
  sequenceIndex?: number
): SpotCandidate | null {
  const filtered = filterTargetedSpots(candidates, filters);
  if (filtered.length === 0) return null;

  const sorted = [...filtered].sort((a, b) => {
    const hashA = buildCanonicalNodeHash(a.node);
    const hashB = buildCanonicalNodeHash(b.node);
    return hashA.localeCompare(hashB);
  });

  if (!seed) return sorted[0];

  // Deterministic selection: same seed+sequenceIndex yields the same pick.
  const combinedSeed =
    sequenceIndex === undefined ? seed : combineSeed([seed, sequenceIndex]);
  const rng = createSeededRng(combinedSeed);
  const index = Math.min(sorted.length - 1, Math.floor(rng.next() * sorted.length));
  return sorted[index];
}
