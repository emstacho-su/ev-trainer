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
  onAction?: (action: 'fold' | 'call' | 'raise') => void;
  className?: string;
}

export function ActionPanel({
  actions,
  onAction,
  className,
}: ActionPanelProps) {
  return (
    <div className={cn('bg-gray-900 rounded-lg p-4 shadow-xl', className)}>
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
    </div>
  );
}
