'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

const PRESETS: Record<string, string[]> = {
  'All Positions': [...POSITIONS],
  'Blinds Only': ['SB', 'BB'],
  'Late Position Only': ['CO', 'BTN', 'SB', 'BB'],
};

interface PositionFiltersProps {
  /** Currently selected positions */
  selected: string[];
  /** Callback with updated position array */
  onChange: (positions: string[]) => void;
}

/**
 * Multi-select position filter with toggle chips and quick presets.
 *
 * Minimum selection enforcement: at least one position must remain selected
 * to prevent an empty filter state that would match no scenarios.
 */
export default function PositionFilters({
  selected,
  onChange,
}: PositionFiltersProps) {
  const selectedSet = new Set(selected);

  const handleToggle = useCallback(
    (position: string) => {
      const next = new Set(selected);
      if (next.has(position)) {
        // Prevent deselecting the last remaining position
        if (next.size === 1) return;
        next.delete(position);
      } else {
        next.add(position);
      }
      onChange(Array.from(next));
    },
    [selected, onChange]
  );

  const applyPreset = useCallback(
    (presetName: string) => {
      onChange(Array.from(PRESETS[presetName]));
    },
    [onChange]
  );

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
        Positions
      </legend>

      {/* Preset buttons */}
      <div className="mb-2 flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => applyPreset(name)}
            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            {name}
          </button>
        ))}
      </div>

      {/* Toggle chips */}
      <div className="flex flex-wrap gap-2">
        {POSITIONS.map((pos) => {
          const isSelected = selectedSet.has(pos);
          return (
            <button
              key={pos}
              type="button"
              onClick={() => handleToggle(pos)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700'
              )}
              aria-pressed={isSelected}
            >
              {pos}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
