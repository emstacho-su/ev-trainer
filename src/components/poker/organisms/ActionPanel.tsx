import { cn } from '@/lib/utils';
import { ActionButton } from '../molecules/ActionButton';

interface ActionPanelProps {
  actions: Array<{
    action: 'fold' | 'call' | 'raise';
    label?: string;
    state: 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';
    ev?: number;
    frequency?: number;
  }>;
  raiseSizes?: number[];
  onAction?: (action: 'fold' | 'call' | 'raise') => void;
  onRaiseSize?: (size: number) => void;
  className?: string;
}

export function ActionPanel({
  actions,
  raiseSizes = [33, 50, 75, 100],
  onAction,
  onRaiseSize,
  className,
}: ActionPanelProps) {
  const hasRaise = actions.some((a) => a.action === 'raise' && a.state !== 'disabled');

  return (
    <div className={cn('bg-gray-900 rounded-lg p-4 shadow-xl', className)}>
      {/* Action buttons in a row */}
      <div className="flex gap-3">
        {actions.map((actionData) => (
          <ActionButton
            key={actionData.action}
            {...actionData}
            onClick={() => onAction?.(actionData.action)}
            className="flex-1"
          />
        ))}
      </div>

      {/* Raise sizing row */}
      {hasRaise && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap">
            Raise
          </span>
          {raiseSizes.map((size) => (
            <button
              key={size}
              onClick={() => onRaiseSize?.(size)}
              className="flex-1 px-2 py-1.5 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-xs font-medium"
            >
              {size}%
            </button>
          ))}
          <button
            onClick={() => onRaiseSize?.(0)}
            className="px-3 py-1.5 bg-red-700 text-white rounded-md hover:bg-red-600 transition-colors text-xs font-medium"
          >
            All-in
          </button>
        </div>
      )}
    </div>
  );
}
