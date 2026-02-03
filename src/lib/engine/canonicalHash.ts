// src/lib/engine/canonicalHash.ts

import { createHash } from "node:crypto";
import type { ActionId } from "./types";
import type { CanonicalNode } from "./nodeTypes";

const NUMBER_EPS = 1e-12;

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function normalizeNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  if (Object.is(value, -0)) return 0;
  if (Math.abs(value) < NUMBER_EPS) return 0;
  return value;
}

function normalizeNumberArray(values: unknown, name: string): number[] {
  if (!Array.isArray(values)) {
    throw new Error(`${name} must be an array`);
  }
  const nums = values.map((v, i) => normalizeNumber(v, `${name}[${i}]`));
  nums.sort((a, b) => a - b);
  return nums;
}

function assertNonNegativeInteger(value: unknown, name: string): number {
  const num = normalizeNumber(value, name);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`${name} must be an integer >= 0`);
  }
  return num;
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
  const normalized = board.map((card) => normalizeCard(card));
  normalized.sort();
  return normalized;
}

function normalizeActionIds(actions: unknown): ActionId[] {
  if (!Array.isArray(actions)) {
    throw new Error("history.actions must be an array");
  }
  return actions.map((action, i) => {
    if (typeof action !== "string" || action.length === 0) {
      throw new Error(`history.actions[${i}] must be a non-empty string`);
    }
    return action;
  });
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

export function buildCanonicalNodeHash(input: CanonicalNode): string {
  if (input === null || typeof input !== "object") {
    throw new Error("input must be an object");
  }

  assertNonEmptyString(input.gameVersion, "gameVersion");
  assertNonEmptyString(input.abstractionVersion, "abstractionVersion");
  assertNonEmptyString(input.solverVersion, "solverVersion");

  const publicState = input.publicState;
  if (publicState === null || typeof publicState !== "object") {
    throw new Error("publicState must be an object");
  }

  const history = input.history;
  if (history === null || typeof history !== "object") {
    throw new Error("history must be an object");
  }

  const abstraction = input.abstraction;
  if (abstraction === null || typeof abstraction !== "object") {
    throw new Error("abstraction must be an object");
  }

  const payload = {
    abstractionVersion: input.abstractionVersion,
    gameVersion: input.gameVersion,
    solverVersion: input.solverVersion,
    abstraction: {
      betSizesBb: normalizeNumberArray(abstraction.betSizesBb, "abstraction.betSizesBb"),
      maxRaisesPerStreet: assertNonNegativeInteger(
        abstraction.maxRaisesPerStreet,
        "abstraction.maxRaisesPerStreet"
      ),
      raiseSizesBb: normalizeNumberArray(abstraction.raiseSizesBb, "abstraction.raiseSizesBb"),
    },
    history: {
      actions: normalizeActionIds(history.actions),
    },
    publicState: {
      board: normalizeBoard(publicState.board),
      effectiveStackBb: normalizeNumber(publicState.effectiveStackBb, "publicState.effectiveStackBb"),
      potBb: normalizeNumber(publicState.potBb, "publicState.potBb"),
      street: publicState.street,
      toAct: publicState.toAct,
    },
  };

  const canonicalJson = stableStringify(payload);
  return createHash("sha256").update(canonicalJson).digest("hex");
}

export function buildVersionedNodeCacheKey(input: CanonicalNode, nodeHash?: string): string {
  const hash = nodeHash ?? buildCanonicalNodeHash(input);
  return `${input.solverVersion}|${input.abstractionVersion}|${hash}`;
}

export const __internal = {
  stableStringify,
  normalizeBoard,
};
