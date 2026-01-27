// src/lib/engine/filters.test.ts

import { describe, expect, it } from "vitest";
import { validateSpotFilters, validateTreeRestrictions } from "./filters";

describe("validateTreeRestrictions", () => {
  it("accepts valid restrictions (including empty allowedSizesBb)", () => {
    expect(
      validateTreeRestrictions({
        allowedSizesBb: [],
        maxRaisesPerStreet: 0,
      })
    ).toEqual({ allowedSizesBb: [], maxRaisesPerStreet: 0 });

    expect(
      validateTreeRestrictions({
        allowedSizesBb: [2.5, 5, 10],
        maxRaisesPerStreet: 3,
      })
    ).toEqual({ allowedSizesBb: [2.5, 5, 10], maxRaisesPerStreet: 3 });
  });

  it("rejects non-sorted or duplicate allowedSizesBb", () => {
    expect(() =>
      validateTreeRestrictions({ allowedSizesBb: [5, 2.5, 10], maxRaisesPerStreet: 1 })
    ).toThrow(/sorted/i);

    expect(() =>
      validateTreeRestrictions({ allowedSizesBb: [2.5, 5, 5], maxRaisesPerStreet: 1 })
    ).toThrow(/unique|sorted/i);
  });

  it("rejects invalid sizes", () => {
    expect(() =>
      validateTreeRestrictions({ allowedSizesBb: [0.5, 0, 2], maxRaisesPerStreet: 1 })
    ).toThrow(/> 0/i);

    expect(() =>
      validateTreeRestrictions({ allowedSizesBb: [1, Number.NaN, 2], maxRaisesPerStreet: 1 })
    ).toThrow(/finite/i);
  });

  it("rejects invalid maxRaisesPerStreet", () => {
    expect(() =>
      validateTreeRestrictions({ allowedSizesBb: [2.5, 5], maxRaisesPerStreet: -1 })
    ).toThrow(/>= 0/i);

    expect(() =>
      validateTreeRestrictions({ allowedSizesBb: [2.5, 5], maxRaisesPerStreet: 1.2 })
    ).toThrow(/integer/i);
  });
});

describe("validateSpotFilters", () => {
  it("accepts empty object", () => {
    expect(validateSpotFilters({})).toEqual({});
  });

  it("accepts valid filter ranges and enums", () => {
    expect(
      validateSpotFilters({
        streets: ["FLOP", "TURN"],
        heroPositions: ["BTN", "CO"],
        villainPositions: ["BB"],
        minEffectiveStackBb: 20,
        maxEffectiveStackBb: 120,
      })
    ).toEqual({
      streets: ["FLOP", "TURN"],
      heroPositions: ["BTN", "CO"],
      villainPositions: ["BB"],
      minEffectiveStackBb: 20,
      maxEffectiveStackBb: 120,
    });
  });

  it("rejects duplicate enum values", () => {
    expect(() => validateSpotFilters({ streets: ["FLOP", "FLOP"] as any })).toThrow(/unique/i);
    expect(() => validateSpotFilters({ heroPositions: ["BTN", "BTN"] as any })).toThrow(/unique/i);
  });

  it("rejects invalid stack ranges", () => {
    expect(() => validateSpotFilters({ minEffectiveStackBb: 0 })).toThrow(/> 0/i);
    expect(() => validateSpotFilters({ maxEffectiveStackBb: -10 })).toThrow(/> 0/i);
    expect(() =>
      validateSpotFilters({ minEffectiveStackBb: 100, maxEffectiveStackBb: 50 })
    ).toThrow(/<=/i);
  });
});
