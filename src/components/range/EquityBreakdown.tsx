"use client";

// src/components/range/EquityBreakdown.tsx

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EquityTable } from "./EquityTable";
import type { RangeData } from "@/lib/range/types";

type ViewMode = "hand-strength" | "action-groups";

interface EquityBreakdownProps {
  hero: RangeData;
  villain: RangeData;
}

/**
 * Tabbed equity breakdown showing hand categories for hero and villain.
 * Toggles between Hand Strength (by card structure) and Action Groups (by solver recommendation).
 */
export function EquityBreakdown({ hero, villain }: EquityBreakdownProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("hand-strength");

  return (
    <div className="space-y-3">
      {/* Tab buttons */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setViewMode("hand-strength")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === "hand-strength"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Hand Strength
        </button>
        <button
          type="button"
          onClick={() => setViewMode("action-groups")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === "action-groups"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Action Groups
        </button>
      </div>

      {/* Side-by-side tables (responsive: stacked on mobile) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EquityTable range={hero} playerName="Hero" viewMode={viewMode} />
        <EquityTable range={villain} playerName="Villain" viewMode={viewMode} />
      </div>
    </div>
  );
}
