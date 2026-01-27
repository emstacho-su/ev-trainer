// src/lib/engine/filters.ts

import { Positions, Streets, type Position, type Street } from "./types";

export interface TreeRestrictions {
  /**
   * Allowed bet/raise sizes expressed in big blinds (bb).
   * Must be sorted ascending and unique; each value must be finite and > 0.
   * Empty is allowed (represents "no sizing options").
   */
  allowedSizesBb: number[];

  /**
   * Max raises permitted per street (>= 0, integer).
   * (Example: 0 = no raises; 1 = single raise allowed; etc.)
   */
  maxRaisesPerStreet: number;
}

export interface SpotFilters {
  /**
   * Optional constraints for sampling drill "spots".
   * These are purely selection filters; grading remains solver-anchored elsewhere.
   */
  streets?: Street[];
  heroPositions?: Position[];
  villainPositions?: Position[];

  minEffectiveStackBb?: number;
  maxEffectiveStackBb?: number;
}

function isSortedStrictAscending(nums: number[]): boolean {
  for (let i = 1; i < nums.length; i++) {
    if (!(nums[i] > nums[i - 1])) return false;
  }
  return true;
}

function assertFiniteNumber(n: unknown, name: string): asserts n is number {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function assertOptionalFiniteNumber(n: unknown, name: string): void {
  if (n === undefined) return;
  assertFiniteNumber(n, name);
}

function assertNonNegativeInteger(n: unknown, name: string): asserts n is number {
  assertFiniteNumber(n, name);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be an integer >= 0`);
  }
}

function assertSortedUniquePositive(nums: unknown, name: string): asserts nums is number[] {
  if (!Array.isArray(nums)) throw new Error(`${name} must be an array`);
  for (let i = 0; i < nums.length; i++) {
    const v = nums[i];
    assertFiniteNumber(v, `${name}[${i}]`);
    if (v <= 0) throw new Error(`${name}[${i}] must be > 0`);
  }
  // "sorted unique" requirement
  if (!isSortedStrictAscending(nums as number[])) {
    throw new Error(`${name} must be sorted ascending and unique`);
  }
}

function assertUniqueEnumList<T extends string>(
  values: unknown,
  allowed: readonly T[],
  name: string
): void {
  if (values === undefined) return;
  if (!Array.isArray(values)) throw new Error(`${name} must be an array`);
  const set = new Set<string>();
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== "string") throw new Error(`${name}[${i}] must be a string`);
    if (!allowed.includes(v as T)) throw new Error(`${name}[${i}] is not a valid value`);
    if (set.has(v)) throw new Error(`${name} must be unique (no duplicates)`);
    set.add(v);
  }
}

export function validateTreeRestrictions(input: TreeRestrictions): TreeRestrictions {
  if (input === null || typeof input !== "object") {
    throw new Error("TreeRestrictions must be an object");
  }

  assertSortedUniquePositive(input.allowedSizesBb, "allowedSizesBb");
  assertNonNegativeInteger(input.maxRaisesPerStreet, "maxRaisesPerStreet");

  return input;
}

export function validateSpotFilters(input: SpotFilters): SpotFilters {
  if (input === null || typeof input !== "object") {
    throw new Error("SpotFilters must be an object");
  }

  assertUniqueEnumList(input.streets, Streets, "streets");
  assertUniqueEnumList(input.heroPositions, Positions, "heroPositions");
  assertUniqueEnumList(input.villainPositions, Positions, "villainPositions");

  assertOptionalFiniteNumber(input.minEffectiveStackBb, "minEffectiveStackBb");
  assertOptionalFiniteNumber(input.maxEffectiveStackBb, "maxEffectiveStackBb");

  if (input.minEffectiveStackBb !== undefined && input.minEffectiveStackBb <= 0) {
    throw new Error("minEffectiveStackBb must be > 0");
  }
  if (input.maxEffectiveStackBb !== undefined && input.maxEffectiveStackBb <= 0) {
    throw new Error("maxEffectiveStackBb must be > 0");
  }
  if (
    input.minEffectiveStackBb !== undefined &&
    input.maxEffectiveStackBb !== undefined &&
    input.minEffectiveStackBb > input.maxEffectiveStackBb
  ) {
    throw new Error("minEffectiveStackBb must be <= maxEffectiveStackBb");
  }

  return input;
}
