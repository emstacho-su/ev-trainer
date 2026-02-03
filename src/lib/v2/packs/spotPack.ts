/**
 * Overview: SpotPack schema/types plus runtime validation and URL loader.
 * Interacts with: engine spot validation and v2 filter metadata expectations.
 * Importance: Guards data integrity for all downstream selection and grading.
 */

import { SpotSchemaVersion, validateSpot, type Spot } from "../../engine/spot";
import {
  Positions,
  Streets,
  type Position,
  type Street,
} from "../../engine/types";

export const SpotPackSchemaVersion = "1" as const;
export type SpotPackSchemaVersion = typeof SpotPackSchemaVersion;

export const PotTypes = ["SRP", "3BP"] as const;
export type PotType = (typeof PotTypes)[number];

export interface SpotMeta {
  street: Street;
  heroPosition: Position;
  villainPosition: Position;
  effectiveStackBb: number;
  potType: PotType;
}

export interface SpotEntry {
  spot: Spot;
  meta: SpotMeta;
}

export interface SpotPack {
  schemaVersion: SpotPackSchemaVersion;
  packId: string;
  name: string;
  description?: string;
  author?: string;
  version: string;
  createdAt: string;
  spots: SpotEntry[];
}

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertFiniteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${name} must be an object`);
  }
}

function assertValidDateString(value: unknown, name: string): asserts value is string {
  assertNonEmptyString(value, name);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be a valid ISO date string`);
  }
}

function validateSpotMeta(meta: unknown, spot: Spot): SpotMeta {
  assertObject(meta, "meta");
  const raw = meta as Record<string, unknown>;

  if (typeof raw.street !== "string" || !Streets.includes(raw.street as Street)) {
    throw new Error("meta.street must be a valid street");
  }
  if (
    typeof raw.heroPosition !== "string" ||
    !Positions.includes(raw.heroPosition as Position)
  ) {
    throw new Error("meta.heroPosition must be a valid position");
  }
  if (
    typeof raw.villainPosition !== "string" ||
    !Positions.includes(raw.villainPosition as Position)
  ) {
    throw new Error("meta.villainPosition must be a valid position");
  }
  assertFiniteNumber(raw.effectiveStackBb, "meta.effectiveStackBb");
  if (raw.effectiveStackBb <= 0) {
    throw new Error("meta.effectiveStackBb must be > 0");
  }
  if (typeof raw.potType !== "string" || !PotTypes.includes(raw.potType as PotType)) {
    throw new Error("meta.potType must be a valid pot type");
  }

  const street = raw.street as Street;
  const boardCount = spot.board.length;
  const expectedBoardCount =
    street === "PREFLOP" ? 0 : street === "FLOP" ? 3 : street === "TURN" ? 4 : 5;
  if (boardCount !== expectedBoardCount) {
    throw new Error("meta.street must align with board length");
  }

  const heroPosition = raw.heroPosition as Position;
  const villainPosition = raw.villainPosition as Position;
  if (!spot.positions.includes(heroPosition)) {
    throw new Error("meta.heroPosition must be included in spot.positions");
  }
  if (!spot.positions.includes(villainPosition)) {
    throw new Error("meta.villainPosition must be included in spot.positions");
  }

  const stacks = Object.values(spot.stacksBb);
  const effectiveStackBb = Math.min(...stacks);
  if (Math.abs(effectiveStackBb - (raw.effectiveStackBb as number)) > 1e-9) {
    throw new Error("meta.effectiveStackBb must match effective stack from spot");
  }

  return {
    street,
    heroPosition,
    villainPosition,
    effectiveStackBb: raw.effectiveStackBb as number,
    potType: raw.potType as PotType,
  };
}

function validateSpotEntry(entry: unknown): SpotEntry {
  assertObject(entry, "spot entry");
  const raw = entry as Record<string, unknown>;

  if (!raw.spot) {
    throw new Error("spot entry must include spot");
  }

  const spot = validateSpot(raw.spot as Spot);
  if (spot.schemaVersion !== SpotSchemaVersion) {
    throw new Error(`spot schemaVersion must be '${SpotSchemaVersion}'`);
  }

  const meta = validateSpotMeta(raw.meta, spot);
  return { spot, meta };
}

export function parseSpotPack(input: unknown): SpotPack {
  assertObject(input, "SpotPack");
  const raw = input as Record<string, unknown>;

  if (raw.schemaVersion !== SpotPackSchemaVersion) {
    throw new Error(`SpotPack schemaVersion must be '${SpotPackSchemaVersion}'`);
  }
  assertNonEmptyString(raw.packId, "packId");
  assertNonEmptyString(raw.name, "name");
  assertNonEmptyString(raw.version, "version");
  assertValidDateString(raw.createdAt, "createdAt");

  if (!Array.isArray(raw.spots)) {
    throw new Error("spots must be an array");
  }
  if (raw.spots.length === 0) {
    throw new Error("spots must not be empty");
  }

  const spots = raw.spots.map((entry, index) => {
    try {
      return validateSpotEntry(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`spots[${index}]: ${message}`);
    }
  });

  return {
    schemaVersion: SpotPackSchemaVersion,
    packId: raw.packId as string,
    name: raw.name as string,
    description: raw.description as string | undefined,
    author: raw.author as string | undefined,
    version: raw.version as string,
    createdAt: raw.createdAt as string,
    spots,
  };
}

export async function loadSpotPackFromUrl(
  url: string,
  fetchFn: typeof fetch = fetch
): Promise<SpotPack> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`failed to load spot pack: ${response.status}`);
  }
  const json = (await response.json()) as unknown;
  return parseSpotPack(json);
}
