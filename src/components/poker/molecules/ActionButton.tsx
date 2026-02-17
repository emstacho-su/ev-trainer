import { cn } from '@/lib/utils';

type ActionButtonState = 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';

function getFrequencyBg(frequency: number | undefined): string {
  if (frequency === undefined) return '';
  if (frequency >= 0.6) return 'bg-green-600';
  if (frequency > 0.0) return 'bg-yellow-600';
  return 'bg-red-600';
}

function getBarColor(frequency: number | undefined): string {
  if (frequency === undefined) return 'bg-white';
  if (frequency >= 0.6) return 'bg-green-400';
  if (frequency > 0.0) return 'bg-yellow-400';
  return 'bg-red-400';
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

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <button
        onClick={onClick}
        disabled={state === 'disabled' || isRevealed}
        className={cn(
          'relative px-6 py-3 rounded-lg font-bold text-lg transition-all text-white',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          state === 'idle' && 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500',
          state === 'disabled' && 'bg-gray-800 text-gray-500 cursor-not-allowed',
          state === 'selected' && 'bg-blue-600 ring-2 ring-blue-400',
          // Revealed states: frequency-based background color
          isRevealed && getFrequencyBg(frequency),
          // Fallback if no frequency data
          isRevealed && frequency === undefined && isCorrect && 'bg-[hsl(var(--action-positive))]',
          isRevealed && frequency === undefined && isIncorrect && 'bg-[hsl(var(--action-negative))]',
          // User's choice always gets blue ring
          isRevealed && isUserChoice && 'ring-2 ring-blue-400',
        )}
      >
        <span>{displayLabel}</span>
        {isRevealed && ev !== undefined && (
          <span className="ml-2 text-sm font-normal">{ev > 0 ? '+' : ''}{ev.toFixed(2)} BB</span>
        )}
      </button>
      {isRevealed && frequency !== undefined && (
        <div className="w-full">
          <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn('absolute left-0 top-0 h-full rounded-full transition-all duration-500', getBarColor(frequency))}
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
