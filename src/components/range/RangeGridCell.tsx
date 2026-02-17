import { memo } from "react";
import { cn } from "@/lib/utils";
import type { ActionFrequency } from "@/lib/range/types";
import { getActionColor } from "@/lib/range/colorScheme";

interface RangeGridCellProps {
  hand: string;
  actions: ActionFrequency[];
  isCurrentHand?: boolean;
  onHover?: (hand: string | null) => void;
  onClick?: (hand: string) => void;
}

function RangeGridCellInner({
  hand,
  actions,
  isCurrentHand = false,
  onHover,
  onClick,
}: RangeGridCellProps) {
  const hasActions = actions.length > 0;

  return (
    <button
      type="button"
      className={cn(
        "relative w-full aspect-square overflow-hidden rounded-sm",
        "text-[9px] sm:text-[10px] font-semibold",
        "transition-shadow duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
        hasActions ? "cursor-pointer" : "cursor-default bg-gray-700",
        isCurrentHand &&
          "border-2 border-blue-400 shadow-lg shadow-blue-400/50 ring-2 ring-blue-400/60 z-10",
        !isCurrentHand && "border border-gray-600/50"
      )}
      onClick={() => onClick?.(hand)}
      onMouseEnter={() => onHover?.(hand)}
      onMouseLeave={() => onHover?.(null)}
      aria-label={`${hand}${hasActions ? `: ${actions.map((a) => `${a.type} ${(a.frequency * 100).toFixed(1)}%`).join(", ")}` : ""}`}
    >
      {/* Stacked action bars (bottom-up) */}
      {hasActions && (
        <div className="absolute inset-0 flex flex-col justify-end">
          {actions.map((action) => (
            <div
              key={action.type}
              className="w-full min-h-[2px]"
              style={{
                height: `${action.frequency * 100}%`,
                backgroundColor: getActionColor(action.type),
              }}
              title={`${action.type.toUpperCase()} ${(action.frequency * 100).toFixed(1)}%`}
            />
          ))}
        </div>
      )}

      {/* Hand label overlay */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]",
          "pointer-events-none select-none"
        )}
      >
        {hand}
      </span>
    </button>
  );
}

export const RangeGridCell = memo(RangeGridCellInner, (prev, next) => {
  return (
    prev.hand === next.hand &&
    prev.isCurrentHand === next.isCurrentHand &&
    prev.actions === next.actions
  );
});

RangeGridCell.displayName = "RangeGridCell";
