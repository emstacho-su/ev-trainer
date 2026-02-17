import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getHandAtPosition } from "@/lib/range/gridLayout";
import type { RangeData, ActionFrequency } from "@/lib/range/types";
import { RangeGridCell } from "./RangeGridCell";

interface RangeGridViewProps {
  range: RangeData;
  title?: string;
  currentHand?: string;
  onHandHover?: (hand: string | null) => void;
  onHandClick?: (hand: string) => void;
  className?: string;
}

const EMPTY_ACTIONS: ActionFrequency[] = [];

export function RangeGridView({
  range,
  title,
  currentHand,
  onHandHover,
  onHandClick,
  className,
}: RangeGridViewProps) {
  // Build a lookup map from hand string to actions for O(1) access
  const handMap = useMemo(() => {
    const map = new Map<string, ActionFrequency[]>();
    for (const h of range.hands) {
      map.set(h.hand, h.actions);
    }
    return map;
  }, [range.hands]);

  // Pre-compute grid cells (169 cells, stable reference)
  const cells = useMemo(() => {
    const result: { hand: string; row: number; col: number }[] = [];
    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 13; col++) {
        const hand = getHandAtPosition(row, col);
        if (hand) {
          result.push({ hand, row, col });
        }
      }
    }
    return result;
  }, []);

  return (
    <div className={cn("w-full max-w-lg", className)}>
      {title && (
        <h3 className="text-sm font-semibold mb-1.5 text-gray-200">
          {title}
        </h3>
      )}
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: "repeat(13, 1fr)" }}
      >
        {cells.map(({ hand, row, col }) => (
          <RangeGridCell
            key={`${row}-${col}`}
            hand={hand}
            actions={handMap.get(hand) ?? EMPTY_ACTIONS}
            isCurrentHand={currentHand === hand}
            onHover={onHandHover}
            onClick={onHandClick}
          />
        ))}
      </div>
    </div>
  );
}
