'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

/**
 * Pot type abbreviations:
 * - SRP: Single Raised Pot (one preflop raise, one or more callers)
 * - 3BP: 3-Bet Pot (raise followed by a re-raise preflop)
 * - 4BP: 4-Bet Pot (raise, 3-bet, then a 4-bet preflop)
 */
const POT_TYPES = ['SRP', '3BP', '4BP'] as const;

interface PotTypeFiltersProps {
  /** Currently selected pot types */
  selected: string[];
  /** Callback with updated pot type array */
  onChange: (potTypes: string[]) => void;
}

/**
 * Multi-select pot type filter with toggle chips.
 *
 * Minimum selection enforcement: at least one pot type must remain selected
 * to prevent an empty filter state that would match no scenarios.
 */
export default function PotTypeFilters({
  selected,
  onChange,
}: PotTypeFiltersProps) {
  const selectedSet = new Set(selected);

  const handleToggle = useCallback(
    (potType: string) => {
      const next = new Set(selected);
      if (next.has(potType)) {
        // Prevent deselecting the last remaining pot type
        if (next.size === 1) return;
        next.delete(potType);
      } else {
        next.add(potType);
      }
      onChange(Array.from(next));
    },
    [selected, onChange]
  );

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
        Pot Types
      </legend>

      <div className="flex flex-wrap gap-2">
        {POT_TYPES.map((type) => {
          const isSelected = selectedSet.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleToggle(type)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700'
              )}
              aria-pressed={isSelected}
            >
              {type}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
