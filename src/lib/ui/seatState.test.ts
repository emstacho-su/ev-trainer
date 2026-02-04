import { describe, expect, it } from "vitest";
import {
  assertSeatStateTransition,
  canTransitionSeatState,
  parseSeatState,
  type SeatState,
} from "./seatState";

describe("seatState", () => {
  it("parses valid state payloads", () => {
    const parsed = parseSeatState({ kind: "active", role: "hero" });
    expect(parsed).toEqual({ kind: "active", role: "hero" });
  });

  it("rejects invalid empty-role combinations", () => {
    expect(() => parseSeatState({ kind: "empty", role: "hero" })).toThrow(
      "empty seats must use neutral role"
    );
  });

  it("enforces transition guards", () => {
    const from: SeatState = { kind: "active", role: "hero" };
    const toValid: SeatState = { kind: "acted", role: "hero" };
    const toInvalid: SeatState = { kind: "empty", role: "neutral" };

    expect(canTransitionSeatState(from, toValid)).toBe(true);
    expect(canTransitionSeatState(from, toInvalid)).toBe(false);
    expect(() => assertSeatStateTransition(from, toInvalid)).toThrow(
      "invalid seat transition: active -> empty"
    );
  });
});

