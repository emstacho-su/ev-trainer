// src/lib/ui/rangeMatrix.ts

export const RANGE_MATRIX_RANKS = [
  "A",
  "K",
  "Q",
  "J",
  "T",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
] as const;

export type RangeMatrixViewMode = "hero-actions" | "villain-range";
export type RangeCellGroup = "pair" | "suited" | "offsuit";
export type HeroTone = "raise" | "call" | "fold" | "empty";
export type VillainTone = "occupancy" | "empty";

export interface HeroCellData {
  fold: number;
  call: number;
  raise: number;
  evMix?: number;
  evBest?: number;
}

export interface VillainCellData {
  occupancy: number;
  combos?: number;
  avgEv?: number;
}

export interface RangeCellInput {
  hero?: HeroCellData;
  villain?: VillainCellData;
}

export type RangeMatrixData = Partial<Record<string, RangeCellInput>>;

export interface RangeTooltipField {
  label: string;
  value: string;
}

export interface RangeMatrixCell {
  handClass: string;
  rowIndex: number;
  colIndex: number;
  rowRank: (typeof RANGE_MATRIX_RANKS)[number];
  colRank: (typeof RANGE_MATRIX_RANKS)[number];
  group: RangeCellGroup;
  hero?: HeroCellData;
  villain?: VillainCellData;
  heroTone: HeroTone;
  villainTone: VillainTone;
  heroIntensity: number;
  villainIntensity: number;
  tooltipFields: RangeTooltipField[];
}

export interface RangeMatrixModel {
  view: RangeMatrixViewMode;
  ranks: readonly (typeof RANGE_MATRIX_RANKS)[number][];
  grid: RangeMatrixCell[][];
  cells: RangeMatrixCell[];
}

interface BuildRangeMatrixInput {
  view: RangeMatrixViewMode;
  data: RangeMatrixData;
}

export interface RangeTextExportOptions {
  mode: RangeMatrixViewMode;
  model: RangeMatrixModel;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatEv(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(3)} bb`;
}

function formatNumber(value: number | undefined): string {
  if (value === undefined) return "";
  return value.toFixed(6);
}

function normalizeFrequency(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a finite number in [0, 1]`);
  }
  return value;
}

function normalizeNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
  return value;
}

function assertValidHandClassKey(handClass: string): void {
  if (!/^[AKQJT98765432]{2}(s|o)?$/.test(handClass)) {
    throw new Error(`invalid hand class key: ${handClass}`);
  }
  const [first, second, suitedness] = handClass.split("") as [string, string, string?];
  if (first === second && suitedness !== undefined) {
    throw new Error(`pairs must not include suitedness suffix: ${handClass}`);
  }
  if (first !== second && suitedness === undefined) {
    throw new Error(`non-pairs must include suitedness suffix: ${handClass}`);
  }
}

function buildHandClass(rowIndex: number, colIndex: number): string {
  const rowRank = RANGE_MATRIX_RANKS[rowIndex];
  const colRank = RANGE_MATRIX_RANKS[colIndex];
  if (rowIndex === colIndex) return `${rowRank}${colRank}`;
  if (rowIndex < colIndex) return `${rowRank}${colRank}s`;
  return `${colRank}${rowRank}o`;
}

function buildGroup(rowIndex: number, colIndex: number): RangeCellGroup {
  if (rowIndex === colIndex) return "pair";
  return rowIndex < colIndex ? "suited" : "offsuit";
}

function buildHeroTone(hero: HeroCellData | undefined): { tone: HeroTone; intensity: number } {
  if (!hero) return { tone: "empty", intensity: 0 };
  const fold = normalizeFrequency(hero.fold, "hero.fold");
  const call = normalizeFrequency(hero.call, "hero.call");
  const raise = normalizeFrequency(hero.raise, "hero.raise");
  const candidates: Array<{ tone: Extract<HeroTone, "raise" | "call" | "fold">; value: number }> = [
    { tone: "raise", value: raise },
    { tone: "call", value: call },
    { tone: "fold", value: fold },
  ];
  let winner = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (candidate.value > winner.value) winner = candidate;
  }
  return { tone: winner.tone, intensity: winner.value };
}

function buildVillainTone(villain: VillainCellData | undefined): {
  tone: VillainTone;
  intensity: number;
} {
  if (!villain) return { tone: "empty", intensity: 0 };
  const occupancy = normalizeFrequency(villain.occupancy, "villain.occupancy");
  return { tone: "occupancy", intensity: occupancy };
}

function buildTooltipFields(
  view: RangeMatrixViewMode,
  handClass: string,
  group: RangeCellGroup,
  hero: HeroCellData | undefined,
  villain: VillainCellData | undefined
): RangeTooltipField[] {
  const fields: RangeTooltipField[] = [
    { label: "Hand", value: handClass },
    { label: "Class", value: group },
  ];
  if (view === "hero-actions") {
    const fold = hero?.fold ?? 0;
    const call = hero?.call ?? 0;
    const raise = hero?.raise ?? 0;
    fields.push({ label: "Fold", value: formatPercent(fold) });
    fields.push({ label: "Call", value: formatPercent(call) });
    fields.push({ label: "Raise", value: formatPercent(raise) });
    if (hero?.evMix !== undefined) {
      fields.push({ label: "EV Mix", value: formatEv(hero.evMix) });
    }
    if (hero?.evBest !== undefined) {
      fields.push({ label: "EV Best", value: formatEv(hero.evBest) });
    }
  } else {
    const occupancy = villain?.occupancy ?? 0;
    fields.push({ label: "Occupancy", value: formatPercent(occupancy) });
    if (villain?.combos !== undefined) {
      fields.push({ label: "Combos", value: villain.combos.toFixed(2) });
    }
    if (villain?.avgEv !== undefined) {
      fields.push({ label: "Avg EV", value: formatEv(villain.avgEv) });
    }
  }
  return fields;
}

function validateInputData(data: RangeMatrixData): void {
  for (const key of Object.keys(data)) {
    assertValidHandClassKey(key);
  }
}

export function buildRangeMatrix(input: BuildRangeMatrixInput): RangeMatrixModel {
  validateInputData(input.data);
  const grid: RangeMatrixCell[][] = [];
  const cells: RangeMatrixCell[] = [];

  for (let rowIndex = 0; rowIndex < RANGE_MATRIX_RANKS.length; rowIndex += 1) {
    const row: RangeMatrixCell[] = [];
    for (let colIndex = 0; colIndex < RANGE_MATRIX_RANKS.length; colIndex += 1) {
      const handClass = buildHandClass(rowIndex, colIndex);
      const group = buildGroup(rowIndex, colIndex);
      const source = input.data[handClass];

      const hero = source?.hero
        ? {
            fold: normalizeFrequency(source.hero.fold, "hero.fold"),
            call: normalizeFrequency(source.hero.call, "hero.call"),
            raise: normalizeFrequency(source.hero.raise, "hero.raise"),
            evMix:
              source.hero.evMix === undefined
                ? undefined
                : normalizeNumber(source.hero.evMix, "hero.evMix"),
            evBest:
              source.hero.evBest === undefined
                ? undefined
                : normalizeNumber(source.hero.evBest, "hero.evBest"),
          }
        : undefined;

      const villain = source?.villain
        ? {
            occupancy: normalizeFrequency(source.villain.occupancy, "villain.occupancy"),
            combos:
              source.villain.combos === undefined
                ? undefined
                : normalizeNumber(source.villain.combos, "villain.combos"),
            avgEv:
              source.villain.avgEv === undefined
                ? undefined
                : normalizeNumber(source.villain.avgEv, "villain.avgEv"),
          }
        : undefined;

      const heroTone = buildHeroTone(hero);
      const villainTone = buildVillainTone(villain);
      const tooltipFields = buildTooltipFields(input.view, handClass, group, hero, villain);
      const cell: RangeMatrixCell = {
        handClass,
        rowIndex,
        colIndex,
        rowRank: RANGE_MATRIX_RANKS[rowIndex],
        colRank: RANGE_MATRIX_RANKS[colIndex],
        group,
        hero,
        villain,
        heroTone: heroTone.tone,
        villainTone: villainTone.tone,
        heroIntensity: heroTone.intensity,
        villainIntensity: villainTone.intensity,
        tooltipFields,
      };
      row.push(cell);
      cells.push(cell);
    }
    grid.push(row);
  }

  return {
    view: input.view,
    ranks: RANGE_MATRIX_RANKS,
    grid,
    cells,
  };
}

export function exportRangeMatrixText(options: RangeTextExportOptions): string {
  const columns = [
    "hand",
    "class",
    "hero.fold",
    "hero.call",
    "hero.raise",
    "hero.evMix",
    "hero.evBest",
    "villain.occupancy",
    "villain.combos",
    "villain.avgEv",
  ];

  const lines = [
    "format=ev-trainer.range-matrix.v1",
    `mode=${options.mode}`,
    `columns=${columns.join(",")}`,
  ];

  for (const cell of options.model.cells) {
    lines.push(
      [
        cell.handClass,
        cell.group,
        formatNumber(cell.hero?.fold),
        formatNumber(cell.hero?.call),
        formatNumber(cell.hero?.raise),
        formatNumber(cell.hero?.evMix),
        formatNumber(cell.hero?.evBest),
        formatNumber(cell.villain?.occupancy),
        formatNumber(cell.villain?.combos),
        formatNumber(cell.villain?.avgEv),
      ].join(",")
    );
  }

  return lines.join("\n");
}
