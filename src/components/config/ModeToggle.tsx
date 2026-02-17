'use client';

import { cn } from '@/lib/utils';

interface ModeToggleProps {
  /** Current training mode */
  value: 'PREFLOP' | 'FLOP';
  /** Callback with new mode selection */
  onChange: (mode: 'PREFLOP' | 'FLOP') => void;
}

/**
 * Toggle between Preflop and Flop training modes.
 * Used in the lobby screen only -- not shown in the sidebar during an active session
 * since the mode is locked once training begins.
 */
export default function ModeToggle({ value, onChange }: ModeToggleProps) {
  const modes: Array<{ key: 'PREFLOP' | 'FLOP'; label: string }> = [
    { key: 'PREFLOP', label: 'Preflop' },
    { key: 'FLOP', label: 'Flop' },
  ];

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Training mode">
      {modes.map(({ key, label }) => {
        const isSelected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(key)}
            className={cn(
              'rounded px-4 py-2 font-medium transition-colors',
              isSelected
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                : 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
