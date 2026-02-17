'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { TrainerConfig } from '@/lib/v2/config/types';
import ModeToggle from './ModeToggle';
import GameSetup from './GameSetup';
import PositionFilters from './PositionFilters';
import PotTypeFilters from './PotTypeFilters';

interface TrainingConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTraining: () => void;
  isStarting: boolean;
  canStart: boolean;
  error: string | null;
  config: TrainerConfig;
  onConfigChange: (updates: Partial<TrainerConfig>) => void;
  /** When true, lock session-level fields (mode, gameType, tableSize, stackDepth) */
  isSessionActive?: boolean;
}

/**
 * Native <dialog> popout for training configuration.
 *
 * Follows the exact RangeGridModal pattern:
 * - useRef<HTMLDialogElement> + showModal()/close()
 * - useEffect syncs isOpen prop to imperative API
 * - Backdrop click handler
 * - Native close event listener for ESC key
 *
 * WCAG 2.1 compliant: built-in focus management, ESC key close,
 * backdrop click close, focus trapping -- all provided natively by <dialog>.
 */
export function TrainingConfigDialog({
  isOpen,
  onClose,
  onStartTraining,
  isStarting,
  canStart,
  error,
  config,
  onConfigChange,
  isSessionActive = false,
}: TrainingConfigDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Sync dialog open/close state with isOpen prop
  useEffect(() => {
    if (isOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    } else if (!isOpen && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [isOpen]);

  // Handle native dialog close event (ESC key, form submission)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onDialogClose = () => {
      onClose();
    };

    dialog.addEventListener('close', onDialogClose);
    return () => dialog.removeEventListener('close', onDialogClose);
  }, [onClose]);

  // Handle backdrop click (clicking outside dialog content)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-gray-900 text-white p-0 backdrop:bg-black/60"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-100">Training Setup</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="Close training setup"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Session-level fields (locked when session is active) */}
        <fieldset
          disabled={isSessionActive}
          className={isSessionActive ? 'opacity-50' : ''}
        >
          {isSessionActive && (
            <p className="mb-3 text-xs text-amber-400">
              Locked during active session
            </p>
          )}

          {/* Training Mode */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Training Mode
            </label>
            <ModeToggle
              value={config.mode}
              onChange={(mode) => onConfigChange({ mode })}
            />
          </div>

          {/* Game Setup */}
          <GameSetup
            gameType={config.gameType}
            tableSize={config.tableSize}
            stackDepth={config.stackDepth}
            villainAlwaysRaise={config.villainAlwaysRaise}
            onChange={(updates) => onConfigChange(updates)}
          />
        </fieldset>

        {/* Advanced Filters (collapsible) */}
        <details
          open={isAdvancedOpen}
          onToggle={(e) =>
            setIsAdvancedOpen((e.target as HTMLDetailsElement).open)
          }
          className="mt-4"
        >
          <summary className="cursor-pointer select-none text-sm font-semibold text-gray-300">
            <span className="ml-1">Advanced Filters</span>
            <span className="ml-2 text-xs text-gray-400">
              {isAdvancedOpen ? '\u25BC' : '\u25B6'}
            </span>
          </summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">
                Position Filters
              </p>
              <PositionFilters
                selected={config.positions}
                onChange={(positions) =>
                  onConfigChange({ positions: positions as typeof config.positions })
                }
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-300">
                Pot Type Filters
              </p>
              <PotTypeFilters
                selected={config.potTypes}
                onChange={(potTypes) =>
                  onConfigChange({ potTypes: potTypes as typeof config.potTypes })
                }
              />
            </div>
          </div>
        </details>

        {/* Error message */}
        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        {/* Start Training button */}
        <div className="mt-6">
          <button
            type="button"
            disabled={!canStart || isStarting}
            onClick={onStartTraining}
            className="w-full rounded bg-stone-100 px-6 py-3 font-semibold text-stone-900 transition-colors hover:bg-stone-200 disabled:opacity-50"
          >
            {isStarting ? 'Starting...' : 'Start Training'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
