"use client";

// src/components/range/ActionLegend.tsx

import { useContext, useMemo } from "react";
import { cn } from "@/lib/utils";
import { RangeContext } from "@/lib/range/context";
import { RangeActionTypes } from "@/lib/range/types";
import { ACTION_COLORS } from "@/lib/range/colorScheme";
import type { RangeActionType, RangeData } from "@/lib/range/types";

interface ActionLegendProps {
  range: RangeData;
  title?: string;
}

/** Labels for each action type. */
const ACTION_LABELS: Record<RangeActionType, string> = {
  fold: "Fold",
  call: "Call",
  raise: "Raise",
  jam: "Jam",
};

/**
 * Displays action frequency summary with clickable filter buttons.
 * Each button shows the action label and its aggregate frequency percentage.
 * Clicking a button toggles the filter in RangeContext (highlights matching hands in grid).
 */
export function ActionLegend({ range, title }: ActionLegendProps) {
  const { selectedAction, setSelectedAction } = useContext(RangeContext);

  const frequencies = useMemo(() => {
    const totals: Record<RangeActionType, number> = {
      fold: 0,
      call: 0,
      raise: 0,
      jam: 0,
    };

    for (const hand of range.hands) {
      for (const action of hand.actions) {
        totals[action.type] += action.frequency;
      }
    }

    const handCount = range.hands.length || 1;
    return RangeActionTypes.filter((type) => totals[type] > 0).map((type) => ({
      type,
      percentage: (totals[type] / handCount) * 100,
    }));
  }, [range]);

  function handleClick(action: RangeActionType) {
    setSelectedAction(selectedAction === action ? null : action);
  }

  return (
    <div className="space-y-1.5">
      {title && (
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {frequencies.map(({ type, percentage }) => {
          const isSelected = selectedAction === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleClick(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                "transition-all duration-150 cursor-pointer",
                "text-white",
                isSelected
                  ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-background"
                  : "opacity-80 hover:opacity-100",
              )}
              style={{ backgroundColor: ACTION_COLORS[type] }}
              aria-pressed={isSelected}
              aria-label={`Filter by ${ACTION_LABELS[type]}: ${percentage.toFixed(1)}%`}
            >
              <span>{ACTION_LABELS[type]}</span>
              <span className="opacity-75">{percentage.toFixed(1)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
