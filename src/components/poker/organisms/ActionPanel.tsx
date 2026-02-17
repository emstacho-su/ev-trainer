import { cn } from '@/lib/utils';
import { ActionButton } from '../molecules/ActionButton';

export interface ActionPanelItem {
  actionId: string;
  label: string;
  state: 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';
  ev?: number;
  frequency?: number;
  isUserChoice?: boolean;
}

interface ActionPanelProps {
  actions: ActionPanelItem[];
  onAction?: (actionId: string) => void;
  className?: string;
}

export function ActionPanel({
  actions,
  onAction,
  className,
}: ActionPanelProps) {
  return (
    <div className={cn('bg-gray-900 rounded-lg p-4 shadow-xl', className)}>
      <div className="flex gap-2">
        {actions.map((actionData) => (
          <ActionButton
            key={actionData.actionId}
            {...actionData}
            onClick={() => onAction?.(actionData.actionId)}
            className="flex-1"
          />
        ))}
      </div>
    </div>
  );
}
