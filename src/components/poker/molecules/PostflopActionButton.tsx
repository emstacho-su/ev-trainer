'use client';

import { cn } from '@/lib/utils';

interface PostflopActionButtonProps {
  actionId: string;
  label: string;
  frequency?: number;
  ev?: number;
  potBb: number;
  isSelected: boolean;
  isRevealed: boolean;
  isDeviated: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function getBarColor(frequency: number): string {
  if (frequency >= 0.6) return 'bg-green-400';
  if (frequency > 0.0) return 'bg-yellow-400';
  return 'bg-red-400';
}

export function PostflopActionButton({
  actionId: _actionId,
  label,
  frequency,
  ev,
  potBb: _potBb,
  isSelected,
  isRevealed,
  isDeviated,
  onClick,
  disabled,
}: PostflopActionButtonProps) {
  const isDisabled = disabled || isRevealed;

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={cn(
          'relative px-4 py-3 rounded-lg font-bold text-base text-white w-full',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          !isRevealed && 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500',
          isDisabled && !isRevealed && 'bg-gray-800 text-gray-500 cursor-not-allowed',
          isRevealed && !isSelected && 'bg-gray-700',
          isRevealed && isSelected && 'bg-gray-700 ring-2 ring-green-400',
        )}
      >
        <span className="flex items-center justify-center gap-2">
          <span>{label}</span>
          {isRevealed && (
            <span className="text-sm font-normal">
              {isDeviated ? (
                <span className="text-orange-400 flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  N/A
                </span>
              ) : ev !== undefined ? (
                <span className={ev >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {ev > 0 ? '+' : ''}{ev.toFixed(2)} BB
                </span>
              ) : null}
            </span>
          )}
        </span>
      </button>

      {/* Frequency bar */}
      {isRevealed && frequency !== undefined && (
        <div className="w-full">
          <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn('absolute left-0 top-0 h-full rounded-full', getBarColor(frequency))}
              style={{ width: `${Math.max(frequency * 100, 2)}%` }}
            />
          </div>
          <div className="text-xs text-gray-300 text-center mt-0.5 font-medium">
            {(frequency * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}
