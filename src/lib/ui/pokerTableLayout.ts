export type PokerTableSize = "heads-up" | "6-max" | "9-max";

export interface PokerTableSeatInput {
  id: string;
  label: string;
}

export type PokerTableZoneId =
  | "pot"
  | "community"
  | "hero-cards"
  | "villain-cards"
  | string;

export interface PokerTableZoneInput {
  id: PokerTableZoneId;
  label: string;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PokerSeatLayout {
  id: string;
  label: string;
  seatIndex: number;
  anchor: NormalizedPoint;
}

export interface PokerZoneLayout {
  id: PokerTableZoneId;
  label: string;
  rect: NormalizedRect;
}

export interface PokerTableLayoutModel {
  tableSize: PokerTableSize;
  seats: PokerSeatLayout[];
  zones: PokerZoneLayout[];
}

export interface PokerTableFrame {
  widthPx: number;
  heightPx: number;
  aspectRatio: string;
}

const ANCHOR_MAP: Record<PokerTableSize, NormalizedPoint[]> = {
  "heads-up": [
    { x: 0.5, y: 0.84 },
    { x: 0.5, y: 0.14 },
  ],
  "6-max": [
    { x: 0.5, y: 0.86 },
    { x: 0.18, y: 0.7 },
    { x: 0.18, y: 0.3 },
    { x: 0.5, y: 0.12 },
    { x: 0.82, y: 0.3 },
    { x: 0.82, y: 0.7 },
  ],
  "9-max": [
    { x: 0.5, y: 0.88 },
    { x: 0.26, y: 0.79 },
    { x: 0.1, y: 0.61 },
    { x: 0.1, y: 0.39 },
    { x: 0.26, y: 0.21 },
    { x: 0.5, y: 0.1 },
    { x: 0.74, y: 0.21 },
    { x: 0.9, y: 0.39 },
    { x: 0.9, y: 0.61 },
  ],
};

const DEFAULT_ZONES: Record<string, NormalizedRect> = {
  pot: { x: 0.43, y: 0.42, width: 0.14, height: 0.08 },
  community: { x: 0.31, y: 0.5, width: 0.38, height: 0.12 },
  "hero-cards": { x: 0.44, y: 0.69, width: 0.12, height: 0.08 },
  "villain-cards": { x: 0.44, y: 0.2, width: 0.12, height: 0.08 },
};

const FALLBACK_ZONE: NormalizedRect = { x: 0.45, y: 0.45, width: 0.1, height: 0.06 };

function assertNonEmpty(value: string, name: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertRect(rect: NormalizedRect, name: string): void {
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (!values.every((value) => Number.isFinite(value))) {
    throw new Error(`${name} values must be finite`);
  }
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(`${name} width/height must be positive`);
  }
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > 1 || rect.y + rect.height > 1) {
    throw new Error(`${name} must stay inside normalized 0..1 bounds`);
  }
}

function seatBox(anchor: NormalizedPoint): NormalizedRect {
  return { x: anchor.x - 0.07, y: anchor.y - 0.05, width: 0.14, height: 0.1 };
}

function overlap(a: NormalizedRect, b: NormalizedRect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function buildPokerTableLayout(input: {
  tableSize: PokerTableSize;
  seats: PokerTableSeatInput[];
  zones: PokerTableZoneInput[];
}): PokerTableLayoutModel {
  const anchors = ANCHOR_MAP[input.tableSize];
  if (!anchors) {
    throw new Error("unsupported tableSize");
  }
  if (input.seats.length > anchors.length) {
    throw new Error("seat count exceeds table capacity");
  }

  const seats: PokerSeatLayout[] = input.seats.map((seat, index) => {
    assertNonEmpty(seat.id, "seat.id");
    assertNonEmpty(seat.label, "seat.label");
    return {
      id: seat.id,
      label: seat.label,
      seatIndex: index,
      anchor: anchors[index],
    };
  });

  const zones: PokerZoneLayout[] = input.zones.map((zone) => {
    assertNonEmpty(zone.id, "zone.id");
    assertNonEmpty(zone.label, "zone.label");
    const rect = DEFAULT_ZONES[zone.id] ?? FALLBACK_ZONE;
    assertRect(rect, `zone.${zone.id}`);
    return { id: zone.id, label: zone.label, rect };
  });

  // Required center zones must remain collision-free with seat boxes.
  const requiredZoneIds = new Set(["pot", "community"]);
  const requiredZones = zones.filter((zone) => requiredZoneIds.has(zone.id));
  for (const seat of seats) {
    const box = seatBox(seat.anchor);
    for (const zone of requiredZones) {
      if (overlap(box, zone.rect)) {
        throw new Error(`seat '${seat.id}' overlaps required zone '${zone.id}'`);
      }
    }
  }

  return {
    tableSize: input.tableSize,
    seats,
    zones,
  };
}

export function buildPokerTableFrame(containerWidthPx: number): PokerTableFrame {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
    throw new Error("containerWidthPx must be positive");
  }
  const compact = containerWidthPx < 640;
  const aspectRatio = compact ? "4 / 3" : "16 / 10";
  const ratio = compact ? 4 / 3 : 16 / 10;
  const heightPx = Math.round(containerWidthPx / ratio);
  return {
    widthPx: Math.round(containerWidthPx),
    heightPx,
    aspectRatio,
  };
}

