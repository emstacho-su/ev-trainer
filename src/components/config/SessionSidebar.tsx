'use client';

import { useRef, useEffect } from 'react';
import type { TrainerConfig } from '@/lib/v2/config/types';
import { useToast } from '@/lib/ui/toastContext';
import PositionFilters from './PositionFilters';
import PotTypeFilters from './PotTypeFilters';

interface SessionSidebarProps {
  isOpen: boolean;
  config: TrainerConfig;
  onConfigChange: (updates: Partial<TrainerConfig>) => void;
  onClose: () => void;
}

export default function SessionSidebar({
  isOpen,
  config,
  onConfigChange,
  onClose,
}: SessionSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Close on click outside sidebar
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        isOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, onClose]);

  function handlePositionsChange(positions: string[]) {
    onConfigChange({ positions: positions as TrainerConfig['positions'] });
    showToast('Filters will apply on next hand', 'info', 3000);
  }

  function handlePotTypesChange(potTypes: string[]) {
    onConfigChange({ potTypes: potTypes as TrainerConfig['potTypes'] });
    showToast('Filters will apply on next hand', 'info', 3000);
  }

  function handleHandCountChange(value: string) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onConfigChange({ handCountTarget: parsed });
    } else if (value === '') {
      onConfigChange({ handCountTarget: undefined });
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 z-50 flex h-screen w-80 flex-col bg-white shadow-lg transition-transform duration-300 dark:bg-stone-900 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 p-4 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Session Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            aria-label="Close settings"
          >
            &#x2715;
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex flex-col gap-6 overflow-y-auto p-4">
          {/* Locked settings */}
          <fieldset disabled className="opacity-50">
            <legend className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">
              Locked (lobby-only)
            </legend>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Mode, Game Type, Table Size, and Stack Depth cannot be changed
              mid-session. Return to the lobby to adjust these settings.
            </p>
            <div className="mt-2 space-y-1 text-sm text-stone-600 dark:text-stone-400">
              <div>Mode: {config.mode}</div>
              <div>Game Type: {config.gameType}</div>
              <div>Table Size: {config.tableSize}</div>
              <div>Stack Depth: {config.stackDepth}</div>
            </div>
          </fieldset>

          {/* Changeable settings */}
          <div className="space-y-4">
            <PositionFilters
              selected={config.positions}
              onChange={handlePositionsChange}
            />

            <PotTypeFilters
              selected={config.potTypes}
              onChange={handlePotTypesChange}
            />

            <div>
              <label
                htmlFor="hand-count-target"
                className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                Hand Count Target
              </label>
              <input
                id="hand-count-target"
                type="number"
                min={1}
                max={1000}
                value={config.handCountTarget ?? ''}
                onChange={(e) => handleHandCountChange(e.target.value)}
                placeholder="No limit"
                className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
