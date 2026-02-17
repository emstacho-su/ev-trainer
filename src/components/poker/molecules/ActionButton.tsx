import { cn } from '@/lib/utils';

type ActionButtonState = 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';

function getFrequencyColor(frequency: number | undefined, isUserChoice: boolean, state: ActionButtonState): string {
  // Only apply frequency coloring in revealed states
  if (!state.startsWith('revealed')) return '';

  if (isUserChoice) return 'ring-2 ring-blue-500';  // User's choice highlighted
  if (frequency === undefined) return '';             // No coloring pre-reveal

  // Frequency-weighted coloring
  if (frequency >= 0.6) return 'bg-green-600';       // Highest-frequency solver action
  if (frequency > 0.0) return 'bg-yellow-600';        // Lower-frequency solver action
  return 'bg-red-600';                                // Non-solver action (0% frequency)
}

interface ActionButtonProps {
  action: 'fold' | 'call' | 'raise';
  label?: string;
  state: ActionButtonState;
  ev?: number;
  frequency?: number;
  isUserChoice?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ActionButton({ action, label, state, ev, frequency, isUserChoice, onClick, className }: ActionButtonProps) {
  const defaultLabel = action.charAt(0).toUpperCase() + action.slice(1);
  const displayLabel = label ?? defaultLabel;
  const isRevealed = state.startsWith('revealed');
  const isCorrect = state === 'revealed-correct';
  const isIncorrect = state === 'revealed-incorrect';

  const frequencyColor = getFrequencyColor(frequency, isUserChoice ?? false, state);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <button
        onClick={onClick}
        disabled={state === 'disabled' || isRevealed}
        className={cn(
          'relative px-6 py-3 rounded-lg font-bold text-lg transition-all text-white',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          state === 'idle' && 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500',
          state === 'disabled' && 'bg-gray-800 text-gray-500 cursor-not-allowed',
          state === 'selected' && 'bg-blue-600 ring-2 ring-blue-400',
          // Frequency-based coloring in revealed states (overrides default revealed colors)
          isRevealed && !frequencyColor && isCorrect && 'bg-[hsl(var(--action-positive))] ring-2 ring-green-400',
          isRevealed && !frequencyColor && isIncorrect && 'bg-[hsl(var(--action-negative))] ring-2 ring-red-400',
          frequencyColor
        )}
      >
        <span>{displayLabel}</span>
        {isRevealed && ev !== undefined && (
          <span className="ml-2 text-sm font-normal">{ev > 0 ? '+' : ''}{ev.toFixed(2)} BB</span>
        )}
      </button>
      {isRevealed && frequency !== undefined && (
        <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn('absolute left-0 top-0 h-full transition-all', isCorrect ? 'bg-green-500' : 'bg-red-500')}
            style={{ width: `${frequency * 100}%` }}
          />
          <span className="absolute right-1 top-0 text-xs text-white leading-none">{(frequency * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
