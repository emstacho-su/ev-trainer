'use client';

interface GameSetupProps {
  /** Current game type */
  gameType: 'CASH' | 'HU';
  /** Current table size */
  tableSize: '6max' | '9max';
  /** Current stack depth */
  stackDepth: '50bb' | '100bb' | '200bb';
  /** Whether villain always raises */
  villainAlwaysRaise: boolean;
  /** Callback with partial updates to any field */
  onChange: (
    updates: Partial<{
      gameType: 'CASH' | 'HU';
      tableSize: '6max' | '9max';
      stackDepth: '50bb' | '100bb' | '200bb';
      villainAlwaysRaise: boolean;
    }>
  ) => void;
}

/**
 * Game setup selectors for game type, table size, stack depth, and villain behavior.
 * Used in the lobby screen only -- these settings are locked once a training session begins.
 */
export default function GameSetup({
  gameType,
  tableSize,
  stackDepth,
  villainAlwaysRaise,
  onChange,
}: GameSetupProps) {
  const selectClasses =
    'w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100';
  const labelClasses =
    'mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300';

  return (
    <div className="space-y-3">
      {/* Game Type */}
      <div>
        <label htmlFor="game-type" className={labelClasses}>
          Game Type
        </label>
        <select
          id="game-type"
          value={gameType}
          onChange={(e) =>
            onChange({ gameType: e.target.value as 'CASH' | 'HU' })
          }
          className={selectClasses}
        >
          <option value="CASH">Cash</option>
          <option value="HU">Heads-Up</option>
        </select>
      </div>

      {/* Table Size */}
      <div>
        <label htmlFor="table-size" className={labelClasses}>
          Table Size
        </label>
        <select
          id="table-size"
          value={tableSize}
          onChange={(e) =>
            onChange({ tableSize: e.target.value as '6max' | '9max' })
          }
          className={selectClasses}
        >
          <option value="6max">6-max</option>
          <option value="9max">9-max</option>
        </select>
      </div>

      {/* Stack Depth */}
      <div>
        <label htmlFor="stack-depth" className={labelClasses}>
          Stack Depth
        </label>
        <select
          id="stack-depth"
          value={stackDepth}
          onChange={(e) =>
            onChange({
              stackDepth: e.target.value as '50bb' | '100bb' | '200bb',
            })
          }
          className={selectClasses}
        >
          <option value="50bb">50bb</option>
          <option value="100bb">100bb</option>
          <option value="200bb">200bb</option>
        </select>
      </div>

      {/* Villain Always Raise */}
      <div className="flex items-center gap-2">
        <input
          id="villain-always-raise"
          type="checkbox"
          checked={villainAlwaysRaise}
          onChange={(e) => onChange({ villainAlwaysRaise: e.target.checked })}
          className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500 dark:border-stone-600"
        />
        <div>
          <label
            htmlFor="villain-always-raise"
            className="text-sm font-medium text-stone-700 dark:text-stone-300"
          >
            Villain Always Raises
          </label>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Forces villain to always raise for aggressive practice scenarios
          </p>
        </div>
      </div>
    </div>
  );
}
