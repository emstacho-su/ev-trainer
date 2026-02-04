import { describe, expect, it } from "vitest";
import {
  buildPokerTableFrame,
  buildPokerTableLayout,
  type PokerTableSeatInput,
  type PokerTableZoneInput,
} from "./pokerTableLayout";

const zones: PokerTableZoneInput[] = [
  { id: "pot", label: "Pot" },
  { id: "community", label: "Board" },
  { id: "hero-cards", label: "Hero Cards" },
  { id: "villain-cards", label: "Villain Cards" },
];

function seats(count: number): PokerTableSeatInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seat-${i + 1}`,
    label: `Seat ${i + 1}`,
  }));
}

describe("pokerTableLayout", () => {
  it("is deterministic for same props", () => {
    const a = buildPokerTableLayout({
      tableSize: "6-max",
      seats: seats(6),
      zones,
    });
    const b = buildPokerTableLayout({
      tableSize: "6-max",
      seats: seats(6),
      zones,
    });
    expect(a).toEqual(b);
  });

  it("supports all table sizes with deterministic seat ordering", () => {
    const hu = buildPokerTableLayout({ tableSize: "heads-up", seats: seats(2), zones });
    const s6 = buildPokerTableLayout({ tableSize: "6-max", seats: seats(6), zones });
    const s9 = buildPokerTableLayout({ tableSize: "9-max", seats: seats(9), zones });
    expect(hu.seats.map((s) => s.seatIndex)).toEqual([0, 1]);
    expect(s6.seats.map((s) => s.seatIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s9.seats.map((s) => s.seatIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("keeps all anchors inside normalized bounds", () => {
    const model = buildPokerTableLayout({ tableSize: "9-max", seats: seats(9), zones });
    for (const seat of model.seats) {
      expect(seat.anchor.x).toBeGreaterThanOrEqual(0);
      expect(seat.anchor.x).toBeLessThanOrEqual(1);
      expect(seat.anchor.y).toBeGreaterThanOrEqual(0);
      expect(seat.anchor.y).toBeLessThanOrEqual(1);
    }
  });

  it("throws on seat overflow", () => {
    expect(() =>
      buildPokerTableLayout({
        tableSize: "heads-up",
        seats: seats(3),
        zones,
      })
    ).toThrow("seat count exceeds table capacity");
  });

  it("returns stable responsive frame for desktop and mobile", () => {
    const desktop = buildPokerTableFrame(1200);
    const mobile = buildPokerTableFrame(360);
    expect(desktop.aspectRatio).toBe("16 / 10");
    expect(desktop.heightPx).toBe(750);
    expect(mobile.aspectRatio).toBe("4 / 3");
    expect(mobile.heightPx).toBe(270);
  });
});

