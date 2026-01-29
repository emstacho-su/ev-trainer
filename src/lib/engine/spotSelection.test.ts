// src/lib/engine/spotSelection.test.ts

import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "./nodeTypes";
import { combineSeed, createSeededRng } from "./rng";
import { buildCanonicalNodeHash } from "./canonicalHash";
import { filterTargetedSpots, selectTargetedSpot } from "./spotSelection";

function makeNode(street: "FLOP" | "TURN", betSizes: number[], raiseSizes: number[], maxRaises: number): CanonicalNode {
  return {
    gameVersion: "g1",
    abstractionVersion: "a1",
    solverVersion: "s1",
    publicState: {
      street,
      potBb: 10,
      effectiveStackBb: 90,
      board: street === "FLOP" ? ["Ah", "7d", "2c"] : ["Ah", "7d", "2c", "Qs"],
      toAct: "BTN",
    },
    history: { actions: [] },
    toAct: "BTN",
    abstraction: {
      betSizesBb: betSizes,
      raiseSizesBb: raiseSizes,
      maxRaisesPerStreet: maxRaises,
    },
  };
}

describe("filterTargetedSpots", () => {
  it("honors streets, board buckets, and tree restrictions", () => {
    const spotA = { node: makeNode("FLOP", [3.3], [10], 1), boardBucket: "dry" };
    const spotB = { node: makeNode("TURN", [7.5], [20], 2), boardBucket: "wet" };

    const filtered = filterTargetedSpots([spotA, spotB], {
      streets: ["FLOP"],
      boardBuckets: ["dry"],
      treeRestrictions: {
        betSizesBb: [3.3],
        raiseSizesBb: [10],
        maxRaisesPerStreet: 1,
      },
    });

    expect(filtered).toEqual([spotA]);
  });
});

describe("selectTargetedSpot", () => {
  it("selects deterministically using seed and canonical ordering", () => {
    const spotA = { node: makeNode("FLOP", [3.3], [10], 1), boardBucket: "dry" };
    const spotB = { node: makeNode("TURN", [3.3], [10], 1), boardBucket: "dry" };
    const spotC = { node: makeNode("TURN", [7.5], [20], 2), boardBucket: "dry" };

    const candidates = [spotA, spotB, spotC];
    const seed = "seed-select";
    const sequenceIndex = 0;

    const sorted = [...candidates].sort((a, b) =>
      buildCanonicalNodeHash(a.node).localeCompare(buildCanonicalNodeHash(b.node))
    );

    const rng = createSeededRng(combineSeed([seed, sequenceIndex]));
    const index = Math.min(sorted.length - 1, Math.floor(rng.next() * sorted.length));

    const selected = selectTargetedSpot(candidates, {}, seed, sequenceIndex);
    expect(selected).toBe(sorted[index]);
  });

  it("can vary selection across sequence indices", () => {
    const spotA = { node: makeNode("FLOP", [3.3], [10], 1), boardBucket: "dry" };
    const spotB = { node: makeNode("TURN", [3.3], [10], 1), boardBucket: "dry" };
    const spotC = { node: makeNode("TURN", [7.5], [20], 2), boardBucket: "dry" };
    const candidates = [spotA, spotB, spotC];
    const seed = "seed-select";

    const first = selectTargetedSpot(candidates, {}, seed, 0);
    let foundDifferent = false;

    for (let i = 1; i <= 5; i++) {
      const next = selectTargetedSpot(candidates, {}, seed, i);
      if (next !== first) {
        foundDifferent = true;
        break;
      }
    }

    expect(foundDifferent).toBe(true);
  });
});
