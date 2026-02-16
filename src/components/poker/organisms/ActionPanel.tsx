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
  return (
    <div className={cn('bg-gray-900 rounded-lg p-6 shadow-xl', className)}>
      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {actions.map((actionData) => (
          <ActionButton
            key={actionData.action}
            {...actionData}
            onClick={() => onAction?.(actionData.action)}
          />
        ))}
      </div>

      {/* Raise sizing (only show if Raise action is available) */}
      {actions.some((a) => a.action === 'raise' && a.state !== 'disabled') && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <span className="text-xs font-semibold text-gray-400 uppercase mb-2 block">
            Raise Size
          </span>
          <div className="grid grid-cols-2 gap-2">
            {raiseSizes.map((size) => (
              <button
                key={size}
                onClick={() => onRaiseSize?.(size)}
                className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                {size}% Pot
              </button>
            ))}
            <button
              onClick={() => onRaiseSize?.(0)}
              className="px-3 py-2 bg-red-700 text-white rounded-md hover:bg-red-600 transition-colors text-sm font-medium col-span-2"
            >
              All-in
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
