"use client";

import type { ReactNode } from "react";
import {
  buildPokerTableLayout,
  type PokerTableSeatInput,
  type PokerTableSize,
  type PokerTableZoneInput,
} from "../lib/ui/pokerTableLayout";

export interface PokerTableProps {
  tableSize: PokerTableSize;
  seats: PokerTableSeatInput[];
  zones: PokerTableZoneInput[];
  overlays?: ReactNode;
  className?: string;
}

export default function PokerTable({
  tableSize,
  seats,
  zones,
  overlays,
  className,
}: PokerTableProps) {
  const model = buildPokerTableLayout({ tableSize, seats, zones });

  return (
    <section className={`surface-card p-4 ${className ?? ""}`.trim()}>
      <div className="relative mx-auto w-full max-w-4xl">
        <div
          className="relative w-full overflow-hidden rounded-[999px] border border-borderSubtle bg-surfaceMuted aspect-[4/3] sm:aspect-[16/10]"
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

          {model.seats.map((seat) => (
            <div
              key={seat.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-borderStrong bg-surface px-3 py-1 text-[0.75rem] font-semibold text-textPrimary"
              style={{
                left: `${seat.anchor.x * 100}%`,
                top: `${seat.anchor.y * 100}%`,
              }}
            >
              {seat.label}
            </div>
          ))}

          {overlays ? <div className="absolute inset-0">{overlays}</div> : null}
        </div>
      </div>
    </section>
  );
}
