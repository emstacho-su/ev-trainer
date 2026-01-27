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
});

describe("combineSeed", () => {
  it("produces stable seed strings", () => {
    expect(combineSeed(["a", 1, "b"]).toString()).toBe("a|1|b");
  });
});
