// src/lib/engine/canonicalHash.test.ts

import { describe, expect, it } from "vitest";
import { buildCanonicalNodeHash } from "./canonicalHash";
import type { CanonicalNode } from "./nodeTypes";
import type { NodeHistory, NodePublicState } from "./solverAdapter";
import type { ActionAbstraction } from "./nodeTypes";

const basePublicState: NodePublicState = {
  street: "FLOP",
  potBb: 4.5,
  effectiveStackBb: 100,
  board: ["Ah", "7d", "2c"],
  toAct: "BTN",
};

const baseHistory: NodeHistory = {
  actions: ["BET_2.5", "CALL"],
};

const baseAbstraction: ActionAbstraction = {
  betSizesBb: [2.5, 5],
  raiseSizesBb: [7.5, 20],
  maxRaisesPerStreet: 2,
};

const baseInput: CanonicalNode = {
  gameVersion: "HU-NLHE",
  abstractionVersion: "v1",
  solverVersion: "mock-0",
  publicState: basePublicState,
  history: baseHistory,
  toAct: "BTN",
  abstraction: baseAbstraction,
};

describe("buildCanonicalNodeHash", () => {
  it("returns the same hash for identical semantic input", () => {
    const hashA = buildCanonicalNodeHash(baseInput);
    const hashB = buildCanonicalNodeHash({ ...baseInput });
    expect(hashA).toBe(hashB);
  });

  it("is insensitive to key order in objects", () => {
    const publicStateReordered: NodePublicState = {
      toAct: "BTN",
      board: ["Ah", "7d", "2c"],
      effectiveStackBb: 100,
      potBb: 4.5,
      street: "FLOP",
    };

    const historyReordered: NodeHistory = {
      actions: ["BET_2.5", "CALL"],
    };

    const hashA = buildCanonicalNodeHash(baseInput);
    const hashB = buildCanonicalNodeHash({
      abstractionVersion: "v1",
      solverVersion: "mock-0",
      gameVersion: "HU-NLHE",
      publicState: publicStateReordered,
      history: historyReordered,
      toAct: "BTN",
      abstraction: {
        raiseSizesBb: [20, 7.5],
        maxRaisesPerStreet: 2,
        betSizesBb: [5, 2.5],
      },
    });

    expect(hashA).toBe(hashB);
  });

  it("changes hash when action history order changes", () => {
    const hashA = buildCanonicalNodeHash(baseInput);
    const hashB = buildCanonicalNodeHash({
      ...baseInput,
      history: { actions: ["CALL", "BET_2.5"] },
    });
    expect(hashA).not.toBe(hashB);
  });
  it("is insensitive to board card order and case", () => {
    const hashA = buildCanonicalNodeHash(baseInput);
    const hashB = buildCanonicalNodeHash({
      ...baseInput,
      publicState: { ...baseInput.publicState, board: ["7D", "2c", "aH"] },
    });
    expect(hashA).toBe(hashB);
  });
  it("treats -0 and 0 as identical", () => {
    const hashA = buildCanonicalNodeHash({
      ...baseInput,
      publicState: { ...baseInput.publicState, potBb: 0 },
    });
    const hashB = buildCanonicalNodeHash({
      ...baseInput,
      publicState: { ...baseInput.publicState, potBb: -0 },
    });
    expect(hashA).toBe(hashB);
  });

  it("changes hash when semantic input changes", () => {
    const hashA = buildCanonicalNodeHash(baseInput);
    const hashB = buildCanonicalNodeHash({
      ...baseInput,
      publicState: {
        ...baseInput.publicState,
        potBb: baseInput.publicState.potBb + 0.5,
      },
    });

    expect(hashA).not.toBe(hashB);
  });
});
