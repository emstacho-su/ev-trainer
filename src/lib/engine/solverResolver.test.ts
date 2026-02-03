// src/lib/engine/solverResolver.test.ts

import { describe, expect, it } from "vitest";
import { MemoryNodeCache } from "./nodeCache";
import { resolveSolverNode } from "./solverResolver";
import { mockSolve } from "./mockSolver";
import type { CanonicalNode } from "./nodeTypes";
import { buildCanonicalNodeHash } from "./canonicalHash";
import type { SolverNodeOutput } from "./solverAdapter";

const baseNode: CanonicalNode = {
  gameVersion: "HU-NLHE",
  abstractionVersion: "v1",
  solverVersion: "mock-0",
  publicState: {
    street: "FLOP",
    potBb: 4.5,
    effectiveStackBb: 100,
    board: ["Ah", "7d", "2c"],
    toAct: "BTN",
  },
  history: {
    actions: ["BET_2.5", "CALL"],
  },
  toAct: "BTN",
  abstraction: {
    betSizesBb: [2.5, 5],
    raiseSizesBb: [7.5, 20],
    maxRaisesPerStreet: 2,
  },
};

describe("resolveSolverNode", () => {
  it("uses cache on repeated requests (one solver call)", () => {
    const cache = new MemoryNodeCache(10);
    let calls = 0;
    const solve = (node: CanonicalNode) => {
      calls += 1;
      return mockSolve(node);
    };

    const first = resolveSolverNode(baseNode, { cache, solve });
    const second = resolveSolverNode(baseNode, { cache, solve });

    expect(calls).toBe(1);
    expect(second.output).toEqual(first.output);
  });

  it("produces stable keys for semantically identical nodes", () => {
    const cache = new MemoryNodeCache(10);
    const solve = (node: CanonicalNode) => mockSolve(node);

    const nodeA = baseNode;
    const nodeB: CanonicalNode = {
      abstractionVersion: "v1",
      solverVersion: "mock-0",
      gameVersion: "HU-NLHE",
      publicState: {
        toAct: "BTN",
        board: ["2c", "Ah", "7d"],
        effectiveStackBb: 100,
        potBb: 4.5,
        street: "FLOP",
      },
      history: {
        actions: ["BET_2.5", "CALL"],
      },
      toAct: "BTN",
      abstraction: {
        raiseSizesBb: [20, 7.5],
        maxRaisesPerStreet: 2,
        betSizesBb: [5, 2.5],
      },
    };

    const hashA = buildCanonicalNodeHash(nodeA);
    const hashB = buildCanonicalNodeHash(nodeB);
    expect(hashA).toBe(hashB);

    const first = resolveSolverNode(nodeA, { cache, solve });
    const second = resolveSolverNode(nodeB, { cache, solve });
    expect(second.nodeHash).toBe(first.nodeHash);
  });

  it("does not cache invalid solver outputs", () => {
    const cache = new MemoryNodeCache(10);
    const invalidSolve = (): SolverNodeOutput => ({
      status: "ok",
      units: "bb",
      actions: [
        { actionId: "CHECK", frequency: 0.7, ev: 0.1 },
        { actionId: "BET_75PCT", frequency: 0.7, ev: -0.2 },
      ],
    });

    expect(() => resolveSolverNode(baseNode, { cache, solve: invalidSolve })).toThrow();
    expect(cache.size()).toBe(0);

    let calls = 0;
    const validSolve = (node: CanonicalNode) => {
      calls += 1;
      return mockSolve(node);
    };

    resolveSolverNode(baseNode, { cache, solve: validSolve });
    expect(calls).toBe(1);
    expect(cache.size()).toBe(1);
  });

  it("emits cache hit/miss events using the mock solver adapter", () => {
    const cache = new MemoryNodeCache(10);
    const events: { type: "hit" | "miss"; key: { nodeHash: string } }[] = [];

    const first = resolveSolverNode(baseNode, {
      cache,
      solve: mockSolve,
      onCacheEvent: (event) => events.push(event),
    });
    const second = resolveSolverNode(baseNode, {
      cache,
      solve: mockSolve,
      onCacheEvent: (event) => events.push(event),
    });

    expect(first.nodeHash).toBe(second.nodeHash);
    expect(events.map((event) => event.type)).toEqual(["miss", "hit"]);
    expect(events[0]?.key.nodeHash).toBe(first.nodeHash);
    expect(events[1]?.key.nodeHash).toBe(first.nodeHash);
  });
});
