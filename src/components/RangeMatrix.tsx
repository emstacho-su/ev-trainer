/**
 * Overview: Non-proprietary 13x13 range matrix with mode-aware tooltip details.
 * Interacts with: Trainer setup/preview pages that provide range payloads.
 * Importance: Visual inspection surface for hero frequencies and villain occupancy.
 */

"use client";

import { useMemo, useState } from "react";
import {
  buildRangeMatrix,
  type RangeMatrixData,
  type RangeMatrixViewMode,
} from "../lib/ui/rangeMatrix";

interface RangeMatrixProps {
  title?: string;
  mode: RangeMatrixViewMode;
  data: RangeMatrixData;
}

function cellToneClass(mode: RangeMatrixViewMode, heroTone: string, villainTone: string): string {
  if (mode === "hero-actions") {
    if (heroTone === "raise") return "bg-emerald-100 border-emerald-400";
    if (heroTone === "call") return "bg-sky-100 border-sky-400";
    if (heroTone === "fold") return "bg-rose-100 border-rose-400";
    return "bg-stone-50 border-stone-200";
  }
  if (villainTone === "occupancy") return "bg-violet-100 border-violet-400";
  return "bg-stone-50 border-stone-200";
}

export default function RangeMatrix({ title = "Range Matrix", mode, data }: RangeMatrixProps) {
  const model = useMemo(() => buildRangeMatrix({ view: mode, data }), [mode, data]);
  const [activeHandClass, setActiveHandClass] = useState<string>(model.grid[0][0].handClass);

  const activeCell = useMemo(() => {
    return model.cells.find((cell) => cell.handClass === activeHandClass) ?? model.grid[0][0];
  }, [activeHandClass, model.cells, model.grid]);

  return (
    <section className="rounded-xl border border-stone-300 bg-white p-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {mode === "hero-actions" ? "Hero Actions" : "Villain Range"}
        </span>
      </header>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-stone-700">
        {mode === "hero-actions" ? (
          <>
            <span className="rounded border border-emerald-400 bg-emerald-100 px-2 py-0.5">Raise-heavy</span>
            <span className="rounded border border-sky-400 bg-sky-100 px-2 py-0.5">Call-heavy</span>
            <span className="rounded border border-rose-400 bg-rose-100 px-2 py-0.5">Fold-heavy</span>
          </>
        ) : (
          <span className="rounded border border-violet-400 bg-violet-100 px-2 py-0.5">
            Higher occupancy
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1" role="grid" aria-label={title}>
          <thead>
            <tr>
              <th className="p-1 text-left text-[10px] font-semibold text-stone-500">Hand</th>
              {model.ranks.map((rank) => (
                <th key={rank} className="p-1 text-center text-[10px] font-semibold text-stone-500">
                  {rank}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.grid.map((row, rowIndex) => (
              <tr key={model.ranks[rowIndex]}>
                <th className="p-1 text-left text-[10px] font-semibold text-stone-500">
                  {model.ranks[rowIndex]}
                </th>
                {row.map((cell) => {
                  const isActive = cell.handClass === activeCell.handClass;
                  return (
                    <td key={cell.handClass}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveHandClass(cell.handClass)}
                        onFocus={() => setActiveHandClass(cell.handClass)}
                        className={`h-8 w-full rounded border text-[10px] font-semibold text-stone-900 transition ${
                          isActive ? "ring-2 ring-stone-900" : ""
                        } ${cellToneClass(mode, cell.heroTone, cell.villainTone)}`}
                        aria-label={`Range cell ${cell.handClass}`}
                      >
                        {cell.handClass}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
        <h3 className="text-sm font-semibold text-stone-900">Cell Details</h3>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {activeCell.tooltipFields.map((field) => (
            <div key={field.label} className="flex items-center justify-between gap-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {field.label}
              </dt>
              <dd className="text-xs font-semibold text-stone-900">{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
