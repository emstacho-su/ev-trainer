// src/lib/ui/rangeMatrix.test.ts

import { describe, expect, it } from "vitest";
import { buildRangeMatrix, exportRangeMatrixText } from "./rangeMatrix";

describe("range matrix", () => {
  it("maps canonical hand classes to fixed matrix positions", () => {
    const model = buildRangeMatrix({ view: "hero-actions", data: {} });

    expect(model.grid).toHaveLength(13);
    expect(model.grid[0]).toHaveLength(13);
    expect(model.grid[0][0].handClass).toBe("AA");
    expect(model.grid[0][1].handClass).toBe("AKs");
    expect(model.grid[1][0].handClass).toBe("AKo");
    expect(model.grid[12][12].handClass).toBe("22");
  });

  it("builds hero tooltip fields with deterministic order", () => {
    const model = buildRangeMatrix({
      view: "hero-actions",
      data: {
        AKs: {
          hero: {
            fold: 0.1,
            call: 0.3,
            raise: 0.6,
            evMix: 0.35,
            evBest: 0.41,
          },
        },
      },
    });

    const cell = model.grid[0][1];
    expect(cell.handClass).toBe("AKs");
    expect(cell.heroTone).toBe("raise");
    expect(cell.tooltipFields.map((field) => field.label)).toEqual([
      "Hand",
      "Class",
      "Fold",
      "Call",
      "Raise",
      "EV Mix",
      "EV Best",
    ]);
    expect(cell.tooltipFields.map((field) => field.value)).toEqual([
      "AKs",
      "suited",
      "10.0%",
      "30.0%",
      "60.0%",
      "+0.350 bb",
      "+0.410 bb",
    ]);
  });

  it("uses deterministic hero tie-break order raise > call > fold", () => {
    const model = buildRangeMatrix({
      view: "hero-actions",
      data: {
        AKo: {
          hero: {
            fold: 0.4,
            call: 0.4,
            raise: 0.4,
          },
        },
      },
    });

    expect(model.grid[1][0].heroTone).toBe("raise");
    expect(model.grid[1][0].heroIntensity).toBe(0.4);
  });

  it("builds villain tooltip fields with deterministic order", () => {
    const model = buildRangeMatrix({
      view: "villain-range",
      data: {
        AKo: {
          villain: {
            occupancy: 0.72,
            combos: 9,
            avgEv: -0.13,
          },
        },
      },
    });

    const cell = model.grid[1][0];
    expect(cell.handClass).toBe("AKo");
    expect(cell.villainTone).toBe("occupancy");
    expect(cell.tooltipFields.map((field) => field.label)).toEqual([
      "Hand",
      "Class",
      "Occupancy",
      "Combos",
      "Avg EV",
    ]);
    expect(cell.tooltipFields.map((field) => field.value)).toEqual([
      "AKo",
      "offsuit",
      "72.0%",
      "9.00",
      "-0.130 bb",
    ]);
  });

  it("exports deterministic text format in row-major order", () => {
    const model = buildRangeMatrix({
      view: "hero-actions",
      data: {
        AA: {
          hero: {
            fold: 0,
            call: 0.1,
            raise: 0.9,
            evMix: 1.12,
            evBest: 1.19,
          },
        },
      },
    });

    const exportA = exportRangeMatrixText({ mode: "hero-actions", model });
    const exportB = exportRangeMatrixText({ mode: "hero-actions", model });
    expect(exportA).toBe(exportB);
    expect(exportA).toContain("format=ev-trainer.range-matrix.v1");
    expect(exportA).toContain("mode=hero-actions");
    expect(exportA).toContain("AA,pair,0.000000,0.100000,0.900000,1.120000,1.190000,,,");
    const rows = exportA.split("\n");
    expect(rows[3].startsWith("AA,")).toBe(true);
    expect(rows[4].startsWith("AKs,")).toBe(true);
  });

  it("rejects invalid hand class keys", () => {
    expect(() =>
      buildRangeMatrix({
        view: "hero-actions",
        data: {
          AKoX: { hero: { fold: 0.1, call: 0.2, raise: 0.7 } },
        },
      })
    ).toThrowError(/invalid hand class key/);
  });
});
