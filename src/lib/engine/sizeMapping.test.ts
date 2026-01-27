// src/lib/engine/sizeMapping.test.ts

import { describe, expect, it } from "vitest";
import { mapToNearestAllowedSizeBb } from "./sizeMapping";

describe("mapToNearestAllowedSizeBb", () => {
  it("returns exact match when present", () => {
    expect(mapToNearestAllowedSizeBb(5, [2.5, 5, 10])).toBe(5);
  });

  it("maps to nearest allowed size", () => {
    expect(mapToNearestAllowedSizeBb(6, [2.5, 5, 10])).toBe(5);
    expect(mapToNearestAllowedSizeBb(8.9, [2.5, 5, 10])).toBe(10);
  });

  it("tie-breaks toward smaller size when equidistant", () => {
    expect(mapToNearestAllowedSizeBb(7.5, [5, 10])).toBe(5);
  });

  it("does not require allowedSizesBb to be sorted", () => {
    expect(mapToNearestAllowedSizeBb(6, [10, 2.5, 5])).toBe(5);
  });

  it("throws on empty allowed list", () => {
    expect(() => mapToNearestAllowedSizeBb(5, [])).toThrow(/non-empty/i);
  });

  it("throws on invalid input size", () => {
    expect(() => mapToNearestAllowedSizeBb(0, [1, 2])).toThrow();
    expect(() => mapToNearestAllowedSizeBb(-1, [1, 2])).toThrow();
    expect(() => mapToNearestAllowedSizeBb(Number.NaN, [1, 2])).toThrow();
    expect(() => mapToNearestAllowedSizeBb(Number.POSITIVE_INFINITY, [1, 2])).toThrow();
  });

  it("throws on invalid allowed sizes", () => {
    expect(() => mapToNearestAllowedSizeBb(5, [1, 0, 2])).toThrow();
    expect(() => mapToNearestAllowedSizeBb(5, [1, Number.NaN, 2])).toThrow();
  });
});
