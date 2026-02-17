'use client';

import type { SolverActionOutput } from '@/lib/engine/solverAdapter';
import { PostflopActionButton } from './PostflopActionButton';

interface StreetActionPanelProps {
  actions: SolverActionOutput[];
  selectedActionId: string | null;
  isRevealed: boolean;
  isDeviated: boolean;
  potBb: number;
  onAction: (actionId: string) => void;
  disabled?: boolean;
}

/** Map actionId to a human-readable label. */
function actionLabel(actionId: string, potBb: number): string {
  const upper = actionId.toUpperCase();

  if (upper === 'CHECK') return 'Check';
  if (upper === 'FOLD') return 'Fold';
  if (upper === 'CALL') return 'Call';
  if (upper === 'ALL_IN') return 'All-in';

  // BET_33, BET_50, BET_75, BET_100
  const betMatch = upper.match(/^BET_(\d+)$/);
  if (betMatch) {
    const pct = parseInt(betMatch[1], 10);
    const bbAmount = ((pct / 100) * potBb).toFixed(1);
    return `Bet ${pct}% (${bbAmount}bb)`;
  }

  // RAISE_2.2, RAISE_2.5, RAISE_3
  const raiseMatch = upper.match(/^RAISE_([\d.]+)$/);
  if (raiseMatch) {
    return `Raise ${raiseMatch[1]}x`;
  }

  // Fallback: capitalize first letter
  return actionId.charAt(0).toUpperCase() + actionId.slice(1).toLowerCase();
}

export function StreetActionPanel({
  actions,
  selectedActionId,
  isRevealed,
  isDeviated,
  potBb,
  onAction,
  disabled,
}: StreetActionPanelProps) {
  // Loading state when actions haven't arrived yet
  if (actions.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm">Computing GTO strategy...</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {actions.map((action) => (
        <PostflopActionButton
          key={action.actionId}
          actionId={action.actionId}
          label={actionLabel(action.actionId, potBb)}
          frequency={isRevealed ? action.frequency : undefined}
          ev={isRevealed ? action.ev : undefined}
          potBb={potBb}
          isSelected={action.actionId === selectedActionId}
          isRevealed={isRevealed}
          isDeviated={isDeviated}
          onClick={() => onAction(action.actionId)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
