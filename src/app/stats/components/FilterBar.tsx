"use client";

/**
 * Overview: Sticky filter bar with date range presets, custom date picker, and multi-select filters.
 * Interacts with: URL search params for filter state, shadcn Calendar/Popover.
 * Importance: Controls date range, position, scenario, and street filters for all stats dashboard components via URL persistence.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, subDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ConfigPositions } from "@/lib/v2/config/types";
import type { DateRange } from "react-day-picker";

type Preset = "7d" | "30d" | "90d" | "all" | "custom";

const PRESETS: { id: Preset; label: string; days?: number }[] = [
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "90d", label: "90D", days: 90 },
  { id: "all", label: "All" },
];

const SCENARIOS = [
  { value: "RFI", label: "RFI" },
  { value: "FacingOpen", label: "Facing Open" },
  { value: "3Bet", label: "3-Bet" },
  { value: "BlindDefense", label: "Blind Defense" },
] as const;

const STREETS = [
  { value: "preflop", label: "Preflop" },
  { value: "flop", label: "Flop" },
  { value: "turn", label: "Turn" },
  { value: "river", label: "River" },
] as const;

function getPresetFromParams(startDate: string | null, endDate: string | null): Preset {
  if (!startDate && !endDate) return "30d"; // default
  if (!startDate) return "all";

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Allow 1-day tolerance for rounding
  if (Math.abs(diffDays - 7) <= 1) return "7d";
  if (Math.abs(diffDays - 30) <= 1) return "30d";
  if (Math.abs(diffDays - 90) <= 1) return "90d";
  return "custom";
}

/** Parse a comma-separated URL param into a Set, returning empty Set if null. */
function parseParamSet(value: string | null): Set<string> {
  if (!value) return new Set();
  return new Set(value.split(",").filter(Boolean));
}

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPreset = getPresetFromParams(
    searchParams.get("startDate"),
    searchParams.get("endDate")
  );

  const [calendarOpen, setCalendarOpen] = useState(false);

  // Parse multi-select filter state from URL
  const selectedPositions = useMemo(() => parseParamSet(searchParams.get("positions")), [searchParams]);
  const selectedScenarios = useMemo(() => parseParamSet(searchParams.get("scenarios")), [searchParams]);
  const selectedStreets = useMemo(() => parseParamSet(searchParams.get("streets")), [searchParams]);

  const hasActiveFilters = selectedPositions.size > 0 || selectedScenarios.size > 0 || selectedStreets.size > 0;

  const currentRange: DateRange | undefined = useMemo(() => {
    const start = searchParams.get("startDate");
    const end = searchParams.get("endDate");
    if (!start) return undefined;
    return {
      from: new Date(start),
      to: end ? new Date(end) : new Date(),
    };
  }, [searchParams]);

  const updateDateRange = useCallback(
    (startDate: string | null, endDate: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (startDate) {
        params.set("startDate", startDate);
      } else {
        params.delete("startDate");
      }
      if (endDate) {
        params.set("endDate", endDate);
      } else {
        params.delete("endDate");
      }
      router.push(`/stats?${params.toString()}`);
    },
    [router, searchParams]
  );

  /** Toggle a value in a multi-select filter group and update URL. */
  const toggleFilter = useCallback(
    (paramName: string, value: string, currentSet: Set<string>) => {
      const params = new URLSearchParams(searchParams.toString());
      const next = new Set(currentSet);

      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }

      if (next.size === 0) {
        params.delete(paramName);
      } else {
        params.set(paramName, Array.from(next).join(","));
      }

      router.push(`/stats?${params.toString()}`);
    },
    [router, searchParams]
  );

  /** Clear all non-date filters. */
  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("positions");
    params.delete("scenarios");
    params.delete("streets");
    router.push(`/stats?${params.toString()}`);
  }, [router, searchParams]);

  const handlePreset = useCallback(
    (preset: Preset) => {
      const p = PRESETS.find((x) => x.id === preset);
      if (!p) return;

      if (preset === "all") {
        updateDateRange(null, null);
        return;
      }

      if (p.days) {
        const end = new Date();
        const start = subDays(end, p.days);
        updateDateRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
      }
    },
    [updateDateRange]
  );

  const handleCalendarSelect = useCallback(
    (range: DateRange | undefined) => {
      if (!range?.from) return;
      const startStr = format(range.from, "yyyy-MM-dd");
      const endStr = range.to ? format(range.to, "yyyy-MM-dd") : startStr;
      updateDateRange(startStr, endStr);
      if (range.to) {
        setCalendarOpen(false);
      }
    },
    [updateDateRange]
  );

  const dateLabel = useMemo(() => {
    const start = searchParams.get("startDate");
    const end = searchParams.get("endDate");
    if (!start) return "All time";
    const startFormatted = format(new Date(start), "MMM d, yyyy");
    const endFormatted = end ? format(new Date(end), "MMM d, yyyy") : "Now";
    return `${startFormatted} - ${endFormatted}`;
  }, [searchParams]);

  return (
    <div className="sticky top-0 z-20 -mx-4 bg-slate-950/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {/* Row 1: Date presets */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset buttons */}
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePreset(preset.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              currentPreset === preset.id
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            {preset.label}
          </button>
        ))}

        {/* Custom date range picker */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                currentPreset === "custom"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              )}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
              Custom
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={currentRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </PopoverContent>
        </Popover>

        {/* Current date range label */}
        <span className="ml-2 text-sm text-slate-400">{dateLabel}</span>
      </div>

      {/* Row 2: Position, Scenario, Street filters */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Position filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs uppercase text-slate-500">Position</span>
          {ConfigPositions.map((pos) => (
            <button
              key={pos}
              onClick={() => toggleFilter("positions", pos, selectedPositions)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                selectedPositions.has(pos)
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              )}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Scenario filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs uppercase text-slate-500">Scenario</span>
          {SCENARIOS.map((s) => (
            <button
              key={s.value}
              onClick={() => toggleFilter("scenarios", s.value, selectedScenarios)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                selectedScenarios.has(s.value)
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Street filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs uppercase text-slate-500">Street</span>
          {STREETS.map((s) => (
            <button
              key={s.value}
              onClick={() => toggleFilter("streets", s.value, selectedStreets)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                selectedStreets.has(s.value)
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-slate-400 underline underline-offset-2 transition-colors hover:text-slate-200"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
