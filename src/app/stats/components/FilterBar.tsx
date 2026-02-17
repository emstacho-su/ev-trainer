"use client";

/**
 * Overview: Sticky filter bar with date range presets and custom date picker.
 * Interacts with: URL search params for filter state, shadcn Calendar/Popover.
 * Importance: Controls date range for all stats dashboard components via URL persistence.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, subDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

type Preset = "7d" | "30d" | "90d" | "all" | "custom";

const PRESETS: { id: Preset; label: string; days?: number }[] = [
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "90d", label: "90D", days: 90 },
  { id: "all", label: "All" },
];

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

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPreset = getPresetFromParams(
    searchParams.get("startDate"),
    searchParams.get("endDate")
  );

  const [calendarOpen, setCalendarOpen] = useState(false);

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
    </div>
  );
}
