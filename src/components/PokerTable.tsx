"use client";

import type { ReactNode } from "react";
import {
  buildPokerTableLayout,
  type PokerTableSeatInput,
  type PokerTableSize,
  type PokerTableZoneInput,
} from "../lib/ui/pokerTableLayout";
import { buildSeatRenderModel } from "../lib/ui/seatModel";
import type { SeatState } from "../lib/ui/seatState";

export interface PokerTableProps {
  tableSize: PokerTableSize;
  seats: PokerTableSeatInput[];
  zones: PokerTableZoneInput[];
  seatStates?: Record<string, SeatState>;
  overlays?: ReactNode;
  className?: string;
}

function seatStateClass(state: SeatState): string {
  const byKind: Record<SeatState["kind"], string> = {
    empty: "border-borderSubtle bg-surfaceMuted text-textSecondary",
    active: "border-actionPrimary bg-surface text-textPrimary",
    acted: "border-borderStrong bg-surface text-textPrimary",
    folded: "border-borderSubtle bg-surfaceMuted text-textSecondary opacity-70",
  };
  const byRole: Record<SeatState["role"], string> = {
    hero: "ring-2 ring-evPositive",
    villain: "ring-2 ring-evNegative",
    neutral: "",
  };
  return `${byKind[state.kind]} ${byRole[state.role]}`.trim();
}

export default function PokerTable({
  tableSize,
  seats,
  zones,
  seatStates,
  overlays,
  className,
}: PokerTableProps) {
  const model = buildPokerTableLayout({ tableSize, seats, zones });
  const seatModel = buildSeatRenderModel({ tableSize, seats, seatStates });
  const layoutById = new Map(model.seats.map((seat) => [seat.id, seat]));

  return (
    <section className={`surface-card p-3 ${className ?? ""}`.trim()}>
      <div className="relative mx-auto w-full max-w-3xl">
        <div
          className="relative w-full overflow-hidden rounded-[999px] border border-borderSubtle bg-surfaceMuted aspect-[16/9] sm:aspect-[21/9]"
        >
          {model.zones.map((zone) => (
            <div
              key={zone.id}
              className="absolute rounded-md border border-borderSubtle bg-surface px-2 py-1 text-[0.75rem] text-textSecondary"
              style={{
                left: `${zone.rect.x * 100}%`,
                top: `${zone.rect.y * 100}%`,
                width: `${zone.rect.width * 100}%`,
                height: `${zone.rect.height * 100}%`,
              }}
            >
              {zone.label}
            </div>
          ))}

          {seatModel.map((seat) => {
            const layout = layoutById.get(seat.id);
            if (!layout) return null;
            return (
              <div
                key={seat.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-3 py-1 text-[0.75rem] font-semibold ${seatStateClass(
                  seat.state
                )}`}
                style={{
                  left: `${layout.anchor.x * 100}%`,
                  top: `${layout.anchor.y * 100}%`,
                }}
              >
                <span className="mr-1 text-[0.65rem] font-bold">{seat.position}</span>
                <span>{seat.label}</span>
              </div>
            );
          })}

          {overlays ? <div className="absolute inset-0">{overlays}</div> : null}
        </div>
      </div>
    </section>
  );
}
