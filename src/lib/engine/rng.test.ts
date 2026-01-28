// src/lib/engine/rng.test.ts

import { describe, expect, it } from "vitest";
import { combineSeed, createSeededRng } from "./rng";

describe("createSeededRng", () => {
  it("is deterministic for the same seed", () => {
    const rngA = createSeededRng("seed:123");
    const rngB = createSeededRng("seed:123");

    const a = [rngA.next(), rngA.next(), rngA.next()];
    const b = [rngB.next(), rngB.next(), rngB.next()];

    expect(a).toEqual(b);
  });

  it("produces different sequences for different seeds", () => {
    const rngA = createSeededRng("seed:123");
    const rngB = createSeededRng("seed:456");

    const a = [rngA.next(), rngA.next(), rngA.next()];
    const b = [rngB.next(), rngB.next(), rngB.next()];

    expect(a).not.toEqual(b);
  });

  it("matches a golden sequence for a fixed seed", () => {
    const rng = createSeededRng("seed:golden");

    expect(rng.nextUint32()).toBe(2903743666);
    expect(rng.nextUint32()).toBe(2570031585);
    expect(rng.nextUint32()).toBe(1248839336);
    expect(rng.state()).toBe("176ed4ad2");
  });
});

describe("combineSeed", () => {
  it("produces stable seed strings", () => {
    expect(combineSeed(["a", 1, "b"]).toString()).toBe("a|1|b");
  });
});
