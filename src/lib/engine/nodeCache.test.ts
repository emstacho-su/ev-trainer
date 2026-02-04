import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildCacheKey, type CanonicalNode } from "./nodeTypes";
import { CompositeNodeCache, FileNodeCache, MemoryNodeCache } from "./nodeCache";
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
  history: { actions: ["BET_2.5", "CALL"] },
  toAct: "BTN",
  abstraction: {
    betSizesBb: [2.5, 5],
    raiseSizesBb: [7.5, 20],
    maxRaisesPerStreet: 2,
  },
};

const output: SolverNodeOutput = {
  status: "ok",
  units: "bb",
  actions: [{ actionId: "CHECK", frequency: 1, ev: 0 }],
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function createFilePath(fileName: string): string {
  const dir = mkdtempSync(join(tmpdir(), "ev-trainer-cache-"));
  tempDirs.push(dir);
  return join(dir, fileName);
}

describe("nodeCache", () => {
  it("backfills memory cache on persistent hit via composite lookup", () => {
    const key = buildCacheKey("hash-a", baseNode);
    const entry = { key, payload: output, createdAt: "2026-01-01T00:00:00.000Z" };
    const memory = new MemoryNodeCache(10);
    const file = new FileNodeCache(createFilePath("cache.json"));
    file.set(entry);
    const composite = new CompositeNodeCache(memory, file);

    const found = composite.get(key);
    const memoryHit = memory.get(key);

    expect(found).toEqual(entry);
    expect(memoryHit).toEqual(entry);
  });

  it("evicts oldest persistent entries when maxEntries is exceeded", () => {
    const file = new FileNodeCache(createFilePath("cache.json"), 1);
    const keyA = buildCacheKey("hash-a", baseNode);
    const keyB = buildCacheKey("hash-b", baseNode);
    file.set({ key: keyA, payload: output, createdAt: "2026-01-01T00:00:00.000Z" });
    file.set({ key: keyB, payload: output, createdAt: "2026-01-01T00:00:01.000Z" });

    expect(file.get(keyA)).toBeUndefined();
    expect(file.get(keyB)).toBeDefined();
  });
});
