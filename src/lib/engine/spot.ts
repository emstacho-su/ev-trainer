// src/lib/engine/spot.ts

import { createHash } from "node:crypto";
import type { ActionId, Position } from "./types";
import { Positions } from "./types";

export const SpotSchemaVersion = "1" as const;
export type SpotSchemaVersion = typeof SpotSchemaVersion;
export type GameType = "NLHE";

export interface Spot {
  schemaVersion: SpotSchemaVersion;
  spotId: string;
  gameType: GameType;
  blinds: {
    sb: number;
    bb: number;
    ante?: number;
  };
  positions: Position[];
  stacksBb: Partial<Record<Position, number>>;
  potBb: number;
  board: string[];
  history: ActionId[];
  heroToAct: Position;
}

const NUMBER_EPS = 1e-12;

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

function assertNonNegativeNumber(value: unknown, name: string): asserts value is number {
  assertFiniteNumber(value, name);
  if (value < 0) {
    throw new Error(`${name} must be >= 0`);
  }
}

function normalizeNumber(value: number): number {
  if (Object.is(value, -0)) return 0;
  if (Math.abs(value) < NUMBER_EPS) return 0;
  return value;
}

function normalizeCard(card: unknown): string {
  if (typeof card !== "string") {
    throw new Error("board card must be a string");
  }
  const raw = card.trim();
  if (raw.length === 0) throw new Error("board card must not be empty");

  let rank = "";
  let suit = "";

  if (raw.length === 3 && raw.startsWith("10")) {
    rank = "T";
    suit = raw[2];
  } else if (raw.length === 2) {
    rank = raw[0];
    suit = raw[1];
  } else {
    throw new Error(`invalid board card: ${card}`);
  }

  const normalizedRank = rank.toUpperCase();
  const normalizedSuit = suit.toLowerCase();

  if (!"23456789TJQKA".includes(normalizedRank)) {
    throw new Error(`invalid board rank: ${card}`);
  }
  if (!"cdhs".includes(normalizedSuit)) {
    throw new Error(`invalid board suit: ${card}`);
  }

  return `${normalizedRank}${normalizedSuit}`;
}

function normalizeBoard(board: unknown): string[] {
  if (!Array.isArray(board)) {
    throw new Error("board must be an array");
  }
  if (board.length > 5) {
    throw new Error("board must have 0-5 cards");
  }
  const normalized = board.map((card) => normalizeCard(card));
  const seen = new Set<string>();
  for (const card of normalized) {
    if (seen.has(card)) {
      throw new Error("board must not contain duplicate cards");
    }
    seen.add(card);
  }
  normalized.sort();
  return normalized;
}

function normalizePositions(positions: unknown): Position[] {
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new Error("positions must be a non-empty array");
  }
  const seen = new Set<string>();
  const normalized: Position[] = [];
  for (let i = 0; i < positions.length; i++) {
    const value = positions[i];
    if (typeof value !== "string" || !Positions.includes(value as Position)) {
      throw new Error(`positions[${i}] must be a valid position`);
    }
    if (seen.has(value)) {
      throw new Error("positions must be unique");
    }
    seen.add(value);
    normalized.push(value as Position);
  }
  return normalized;
}

function normalizeHistory(history: unknown): ActionId[] {
  if (!Array.isArray(history)) {
    throw new Error("history must be an array");
  }
  return history.map((action, i) => {
    if (typeof action !== "string" || action.length === 0) {
      throw new Error(`history[${i}] must be a non-empty string`);
    }
    return action;
  });
}

function normalizeStacks(
  stacks: unknown,
  positions: Position[]
): Record<Position, number> {
  if (stacks === null || typeof stacks !== "object") {
    throw new Error("stacksBb must be an object");
  }
  const stackRecord = stacks as Record<string, unknown>;
  const normalized = {} as Record<Position, number>;

  for (const position of positions) {
    const value = stackRecord[position];
    assertNonNegativeNumber(value, `stacksBb.${position}`);
    normalized[position] = normalizeNumber(value as number);
  }

  for (const key of Object.keys(stackRecord)) {
    if (!positions.includes(key as Position)) {
      throw new Error(`stacksBb contains unknown position '${key}'`);
    }
  }

  return normalized;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("numbers must be finite");
  }
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toString();
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) {
    throw new Error("cannot stringify undefined");
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item)).join(",");
    return `[${items}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries = keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(",");
    return `{${entries}}`;
  }
  throw new Error(`unsupported value type: ${typeof value}`);
}

// Computes a stable ID for a Spot payload.
export function computeSpotId(input: Omit<Spot, "spotId">): string {
  const payload = {
    schemaVersion: input.schemaVersion,
    gameType: input.gameType,
    blinds: {
      sb: normalizeNumber(input.blinds.sb),
      bb: normalizeNumber(input.blinds.bb),
      ante: input.blinds.ante === undefined ? undefined : normalizeNumber(input.blinds.ante),
    },
    positions: normalizePositions(input.positions),
    stacksBb: normalizeStacks(input.stacksBb, input.positions),
    potBb: normalizeNumber(input.potBb),
    board: normalizeBoard(input.board),
    history: normalizeHistory(input.history),
    heroToAct: input.heroToAct,
  };
  const canonicalJson = stableStringify(payload);
  return createHash("sha256").update(canonicalJson).digest("hex");
}

// Validates Spot invariants; optionally verifies the spotId hash.
export function validateSpot(
  spot: Spot,
  options: { verifySpotId?: boolean } = {}
): Spot {
  if (spot === null || typeof spot !== "object") {
    throw new Error("spot must be an object");
  }

  if (spot.schemaVersion !== SpotSchemaVersion) {
    throw new Error(`spot schemaVersion must be '${SpotSchemaVersion}'`);
  }

  assertNonEmptyString(spot.spotId, "spotId");

  if (spot.gameType !== "NLHE") {
    throw new Error("gameType must be 'NLHE'");
  }

  if (spot.blinds === null || typeof spot.blinds !== "object") {
    throw new Error("blinds must be an object");
  }
  assertFiniteNumber(spot.blinds.sb, "blinds.sb");
  assertFiniteNumber(spot.blinds.bb, "blinds.bb");
  if (spot.blinds.sb <= 0 || spot.blinds.bb <= 0) {
    throw new Error("blinds must be > 0");
  }
  if (spot.blinds.ante !== undefined) {
    assertNonNegativeNumber(spot.blinds.ante, "blinds.ante");
  }

  const positions = normalizePositions(spot.positions);
  if (!positions.includes(spot.heroToAct)) {
    throw new Error("heroToAct must be included in positions");
  }

  normalizeStacks(spot.stacksBb, positions);
  assertNonNegativeNumber(spot.potBb, "potBb");
  normalizeBoard(spot.board);
  normalizeHistory(spot.history);

  if (options.verifySpotId) {
    const computed = computeSpotId({
      schemaVersion: spot.schemaVersion,
      gameType: spot.gameType,
      blinds: spot.blinds,
      positions: spot.positions,
      stacksBb: spot.stacksBb,
      potBb: spot.potBb,
      board: spot.board,
      history: spot.history,
      heroToAct: spot.heroToAct,
    });
    if (computed !== spot.spotId) {
      throw new Error("spotId does not match computed hash");
    }
  }

  return spot;
}
