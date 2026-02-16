import { cn } from '@/lib/utils';

type ActionButtonState = 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';

interface ActionButtonProps {
  action: 'fold' | 'call' | 'raise';
  label?: string;
  state: ActionButtonState;
  ev?: number;
  frequency?: number;
  onClick?: () => void;
  className?: string;
}

export function ActionButton({ action, label, state, ev, frequency, onClick, className }: ActionButtonProps) {
  const defaultLabel = action.charAt(0).toUpperCase() + action.slice(1);
  const displayLabel = label ?? defaultLabel;
  const isRevealed = state.startsWith('revealed');
  const isCorrect = state === 'revealed-correct';
  const isIncorrect = state === 'revealed-incorrect';

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <button
        onClick={onClick}
        disabled={state === 'disabled' || isRevealed}
        className={cn(
          'relative px-6 py-3 rounded-lg font-bold text-lg transition-all',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          state === 'idle' && 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500',
          state === 'disabled' && 'bg-gray-800 text-gray-500 cursor-not-allowed',
          state === 'selected' && 'bg-blue-600 text-white ring-2 ring-blue-400',
          isCorrect && 'bg-[hsl(var(--action-positive))] text-white ring-2 ring-green-400',
          isIncorrect && 'bg-[hsl(var(--action-negative))] text-white ring-2 ring-red-400'
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
