// src/lib/v2/api/sessionValidation.ts
// Input validation, parsing, and deterministic ID derivation for session API.

import type { SpotFilterInput } from "../filters/spotFilters";
import { EffectiveStackBuckets } from "../filters/spotFilters";
import { PotTypes } from "../packs/spotPack";
import type { SessionMode } from "../sessionStore";
import { Positions, Streets } from "../../engine/types";
import { createHash } from "node:crypto";

// ─── Constants ──────────────────────────────────────────────────────────────

export const DEFAULT_PACK_ID = "ev-dev-pack-v1";
export const SESSION_ID_HASH_LENGTH = 24;
export const DEFAULT_GRADING_CONFIG = {
  epsilon: 0.01,
  gradeBy: "evLossVsBest" as const,
};

// ─── Request shapes ─────────────────────────────────────────────────────────

export interface StartRequest {
  seed: string;
  sessionId?: string;
  mode: SessionMode;
  packId?: string;
  filters?: SpotFilterInput;
  decisionsPerSession?: number;
}

export interface NextRequest {
  seed: string;
  sessionId: string;
}

export interface SubmitRequest {
  seed: string;
  sessionId: string;
  spot: unknown;
  actionId: string;
}

// ─── Type guards and parsers ────────────────────────────────────────────────

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function requireString(
  source: Record<string, unknown>,
  key: string
): string | null {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value;
}

export function requireNumber(
  source: Record<string, unknown>,
  key: string
): number | null {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function parseMode(value: unknown): SessionMode | null {
  if (value === "TRAINING" || value === "PRACTICE") return value;
  return null;
}

export function parseFilters(value: unknown): SpotFilterInput | null {
  if (value === undefined) return {};
  if (!isObject(value)) return null;
  const raw = value as Record<string, unknown>;
  const filters: SpotFilterInput = {};

  if (raw.street !== undefined) {
    if (typeof raw.street !== "string" || !Streets.includes(raw.street as typeof Streets[number]))
      return null;
    filters.street = raw.street as SpotFilterInput["street"];
  }
  if (raw.heroPosition !== undefined) {
    if (
      typeof raw.heroPosition !== "string" ||
      !Positions.includes(raw.heroPosition as typeof Positions[number])
    )
      return null;
    filters.heroPosition = raw.heroPosition as SpotFilterInput["heroPosition"];
  }
  if (raw.villainPosition !== undefined) {
    if (
      typeof raw.villainPosition !== "string" ||
      !Positions.includes(raw.villainPosition as typeof Positions[number])
    )
      return null;
    filters.villainPosition =
      raw.villainPosition as SpotFilterInput["villainPosition"];
  }
  if (raw.potType !== undefined) {
    if (
      typeof raw.potType !== "string" ||
      (raw.potType !== "ANY" && !PotTypes.includes(raw.potType as typeof PotTypes[number]))
    )
      return null;
    filters.potType = raw.potType as SpotFilterInput["potType"];
  }
  if (raw.effectiveStackBbBucket !== undefined) {
    if (
      typeof raw.effectiveStackBbBucket !== "string" ||
      !EffectiveStackBuckets.includes(
        raw.effectiveStackBbBucket as typeof EffectiveStackBuckets[number]
      )
    )
      return null;
    filters.effectiveStackBbBucket =
      raw.effectiveStackBbBucket as SpotFilterInput["effectiveStackBbBucket"];
  }

  if (raw.positions !== undefined) {
    if (!Array.isArray(raw.positions)) return null;
    const positions = raw.positions as unknown[];
    if (
      !positions.every(
        (p) =>
          typeof p === "string" &&
          Positions.includes(p as typeof Positions[number])
      )
    )
      return null;
    filters.heroPositions = positions as SpotFilterInput["heroPositions"];
  }

  if (raw.potTypes !== undefined) {
    if (!Array.isArray(raw.potTypes)) return null;
    const pots = raw.potTypes as unknown[];
    if (
      !pots.every(
        (p) =>
          typeof p === "string" &&
          (p === "ANY" || PotTypes.includes(p as typeof PotTypes[number]))
      )
    )
      return null;
    filters.potTypes = pots as SpotFilterInput["potTypes"];
  }

  return filters;
}

// ─── Deterministic ID derivation ────────────────────────────────────────────

export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function deriveSessionId(
  input: { seed: string; mode: SessionMode; packId?: string },
  filters: SpotFilterInput
): string {
  const packed = stableStringify({
    seed: input.seed,
    packId: input.packId ?? DEFAULT_PACK_ID,
    mode: input.mode,
    filters,
  });
  const digest = createHash("sha256").update(packed).digest("hex");
  return `sess_${digest.slice(0, SESSION_ID_HASH_LENGTH)}`;
}

export function deriveSelectionSessionId(input: {
  seed: string;
  packId: string;
  filters: SpotFilterInput;
}): string {
  const packed = stableStringify({
    seed: input.seed,
    packId: input.packId,
    filters: input.filters,
  });
  const digest = createHash("sha256").update(packed).digest("hex");
  return `sel_${digest.slice(0, SESSION_ID_HASH_LENGTH)}`;
}
