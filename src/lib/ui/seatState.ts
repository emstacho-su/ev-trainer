export type SeatRole = "hero" | "villain" | "neutral";

export type SeatState =
  | { kind: "empty"; role: "neutral" }
  | { kind: "active"; role: SeatRole }
  | { kind: "acted"; role: SeatRole }
  | { kind: "folded"; role: SeatRole };

const ALLOWED_TRANSITIONS: Record<SeatState["kind"], SeatState["kind"][]> = {
  empty: ["active"],
  active: ["acted", "folded"],
  acted: ["active", "folded"],
  folded: ["active"],
};

function assertRole(role: unknown): role is SeatRole {
  return role === "hero" || role === "villain" || role === "neutral";
}

export function parseSeatState(input: unknown): SeatState {
  if (typeof input !== "object" || input === null) {
    throw new Error("seat state must be an object");
  }
  const raw = input as { kind?: unknown; role?: unknown };
  if (
    raw.kind !== "empty" &&
    raw.kind !== "active" &&
    raw.kind !== "acted" &&
    raw.kind !== "folded"
  ) {
    throw new Error("seat state kind is invalid");
  }
  if (!assertRole(raw.role)) {
    throw new Error("seat state role is invalid");
  }
  if (raw.kind === "empty" && raw.role !== "neutral") {
    throw new Error("empty seats must use neutral role");
  }
  return { kind: raw.kind, role: raw.role } as SeatState;
}

export function canTransitionSeatState(from: SeatState, to: SeatState): boolean {
  return ALLOWED_TRANSITIONS[from.kind].includes(to.kind);
}

export function assertSeatStateTransition(from: SeatState, to: SeatState): void {
  if (!canTransitionSeatState(from, to)) {
    throw new Error(`invalid seat transition: ${from.kind} -> ${to.kind}`);
  }
}

