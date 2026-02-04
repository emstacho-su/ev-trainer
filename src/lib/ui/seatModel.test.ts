import { describe, expect, it } from "vitest";
import { buildSeatRenderModel } from "./seatModel";
import { getPositionOrder } from "./seatPositions";

function seats(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `seat-${i + 1}`,
    label: `Seat ${i + 1}`,
  }));
}

describe("seatModel", () => {
  it("maps deterministic position order for all table sizes", () => {
    const hu = buildSeatRenderModel({ tableSize: "heads-up", seats: seats(2) });
    expect(hu.map((s) => s.position)).toEqual(getPositionOrder("heads-up"));

    const s6 = buildSeatRenderModel({ tableSize: "6-max", seats: seats(6) });
    expect(s6.map((s) => s.position)).toEqual(getPositionOrder("6-max"));

    const s9 = buildSeatRenderModel({ tableSize: "9-max", seats: seats(9) });
    expect(s9.map((s) => s.position)).toEqual(getPositionOrder("9-max"));
  });


  it("fails fast on seat count mismatch", () => {
    expect(() => buildSeatRenderModel({ tableSize: "heads-up", seats: seats(1) })).toThrow(
      "seat count mismatch for heads-up: expected 2, got 1"
    );
  });

  it("fails fast on invalid seat state payload", () => {
    expect(() =>
      buildSeatRenderModel({
        tableSize: "heads-up",
        seats: seats(2),
        seatStates: {
          "seat-1": { kind: "empty", role: "hero" } as never,
        },
      })
    ).toThrow("empty seats must use neutral role");
  });

  it("replays exactly for same input model", () => {
    const input = {
      tableSize: "6-max" as const,
      seats: seats(6),
      seatStates: {
        "seat-1": { kind: "active", role: "hero" as const },
        "seat-2": { kind: "folded", role: "villain" as const },
      },
    } as const;
    const a = buildSeatRenderModel(input);
    const b = buildSeatRenderModel(input);
    expect(a).toEqual(b);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });
});
