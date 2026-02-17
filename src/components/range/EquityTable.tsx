"use client";

// src/components/range/EquityTable.tsx

import { useContext, useMemo } from "react";
import { cn } from "@/lib/utils";
import { RangeContext } from "@/lib/range/context";
import { categorizeHandStrength } from "@/lib/range/rangeHelpers";
import type { EquityCategory, RangeData, RangeActionType } from "@/lib/range/types";

type ViewMode = "hand-strength" | "action-groups";

interface EquityTableProps {
  range: RangeData;
  playerName: string;
  viewMode: ViewMode;
}

/** Display labels for equity categories. */
const CATEGORY_LABELS: Record<EquityCategory, string> = {
  "premium-pairs": "Premium Pairs (AA-JJ)",
  "medium-pairs": "Medium Pairs (TT-88)",
  "small-pairs": "Small Pairs (77-22)",
  broadway: "Broadway",
  "suited-connectors": "Suited Connectors",
  "suited-gappers": "Suited Gappers",
  offsuit: "Offsuit",
};

/** Action group labels. */
const ACTION_GROUP_LABELS: Record<string, string> = {
  "pure-raise": "Pure Raise",
  "mixed-raise-call": "Mixed Raise/Call",
  "pure-call": "Pure Call",
  "pure-fold": "Pure Fold",
};

interface CategoryRow {
  key: string;
  label: string;
  count: number;
  percentage: number;
  equityCategory: EquityCategory | null;
}

function classifyActionGroup(actions: { type: RangeActionType; frequency: number }[]): string {
  const dominant = actions.reduce(
    (max, a) => (a.frequency > max.frequency ? a : max),
    { type: "fold" as RangeActionType, frequency: 0 },
  );

  const hasRaise = actions.some((a) => (a.type === "raise" || a.type === "jam") && a.frequency > 0.05);
  const hasCall = actions.some((a) => a.type === "call" && a.frequency > 0.05);

  if (hasRaise && hasCall) return "mixed-raise-call";
  if (hasRaise) return "pure-raise";
  if (hasCall) return "pure-call";
  if (dominant.type === "fold") return "pure-fold";
  return "pure-fold";
}

/**
 * Displays a table of hand categories with count and percentage.
 * Supports two view modes: hand-strength (by card structure) and action-groups (by solver recommendation).
 */
export function EquityTable({ range, playerName, viewMode }: EquityTableProps) {
  const { selectedEquityCategory, setSelectedEquityCategory } =
    useContext(RangeContext);

  const rows = useMemo<CategoryRow[]>(() => {
    const total = range.hands.length || 1;

    if (viewMode === "hand-strength") {
      const groups = new Map<EquityCategory, number>();
      for (const hand of range.hands) {
        const cat = categorizeHandStrength(hand.hand);
        groups.set(cat, (groups.get(cat) ?? 0) + 1);
      }

      const order: EquityCategory[] = [
        "premium-pairs",
        "medium-pairs",
        "small-pairs",
        "broadway",
        "suited-connectors",
        "suited-gappers",
        "offsuit",
      ];

      return order
        .filter((cat) => (groups.get(cat) ?? 0) > 0)
        .map((cat) => ({
          key: cat,
          label: CATEGORY_LABELS[cat],
          count: groups.get(cat)!,
          percentage: ((groups.get(cat)! / total) * 100),
          equityCategory: cat,
        }));
    }

    // Action groups view
    const groups = new Map<string, number>();
    for (const hand of range.hands) {
      const group = classifyActionGroup(hand.actions);
      groups.set(group, (groups.get(group) ?? 0) + 1);
    }

    const order = ["pure-raise", "mixed-raise-call", "pure-call", "pure-fold"];
    return order
      .filter((g) => (groups.get(g) ?? 0) > 0)
      .map((g) => ({
        key: g,
        label: ACTION_GROUP_LABELS[g] ?? g,
        count: groups.get(g)!,
        percentage: ((groups.get(g)! / total) * 100),
        equityCategory: null,
      }));
  }, [range, viewMode]);

  function handleRowClick(row: CategoryRow) {
    if (row.equityCategory === null) return;
    setSelectedEquityCategory(
      selectedEquityCategory === row.equityCategory ? null : row.equityCategory,
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{playerName}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-1 text-left font-medium text-muted-foreground">
              Category
            </th>
            <th className="pb-1 text-right font-medium text-muted-foreground w-12">
              #
            </th>
            <th className="pb-1 text-right font-medium text-muted-foreground w-14">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSelected = row.equityCategory !== null && selectedEquityCategory === row.equityCategory;
            const isClickable = row.equityCategory !== null;
            return (
              <tr
                key={row.key}
                onClick={() => handleRowClick(row)}
                className={cn(
                  "border-b border-border/50 transition-colors",
                  isClickable && "cursor-pointer hover:bg-accent/50",
                  isSelected && "bg-blue-500/20 text-blue-300",
                )}
              >
                <td className="py-1">{row.label}</td>
                <td className="py-1 text-right tabular-nums">{row.count}</td>
                <td className="py-1 text-right tabular-nums">
                  {row.percentage.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
