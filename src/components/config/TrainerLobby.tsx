'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTrainerConfig } from '@/lib/v2/hooks/useTrainerConfig';
import ConfigCard from './ConfigCard';
import ModeToggle from './ModeToggle';
import GameSetup from './GameSetup';
import PositionFilters from './PositionFilters';
import PotTypeFilters from './PotTypeFilters';

/**
 * Lobby screen for trainer configuration.
 * Renders config cards (essentials + advanced filters) with a Start Training button.
 * Config state is loaded from / saved to localStorage via useTrainerConfig.
 */
export default function TrainerLobby() {
  const { config, updateConfig, isLoading } = useTrainerConfig();
  const router = useRouter();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStart = useMemo(() => {
    if (!config) return false;
    return config.positions.length > 0 && config.potTypes.length > 0;
  }, [config]);

  const handleStartTraining = async () => {
    if (!config || !canStart || isStarting) return;

    setIsStarting(true);
    setError(null);

    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: crypto.randomUUID(),
          mode: config.mode,
          packId: 'default',
          filters: {
            positions: config.positions,
            potTypes: config.potTypes,
          },
        }),
      });

      if (res.status === 201 || res.ok) {
        const data = await res.json();
        const sessionId = data.session?.sessionId ?? data.sessionId;
        router.push(`/session?sessionId=${sessionId}`);
      } else {
        const data = await res.json().catch(() => null);
        const msg =
          data?.error?.message ?? `Failed to start session (${res.status})`;
        setError(msg);
        console.error('Failed to start training session:', msg);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to start session';
      setError(msg);
      console.error('Failed to start training session:', err);
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-400">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
          Trainer Configuration
        </h1>
        <p className="text-stone-500 dark:text-stone-400">
          Customize your training session
        </p>
      </div>

      {/* Essentials Card */}
      <ConfigCard title="Essentials" subtitle="Core training settings">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Training Mode
            </label>
            <ModeToggle
              value={config.mode}
              onChange={(mode) => updateConfig({ mode })}
            />
          </div>
          <GameSetup
            gameType={config.gameType}
            tableSize={config.tableSize}
            stackDepth={config.stackDepth}
            villainAlwaysRaise={config.villainAlwaysRaise}
            onChange={(updates) => updateConfig(updates)}
          />
        </div>
      </ConfigCard>

      {/* Advanced Filters (collapsible) */}
      <details
        open={isAdvancedOpen}
        onToggle={(e) =>
          setIsAdvancedOpen((e.target as HTMLDetailsElement).open)
        }
      >
        <summary className="cursor-pointer select-none text-sm font-semibold text-stone-700 dark:text-stone-300">
          <span className="ml-1">Advanced Filters</span>
          <span className="ml-2 text-xs text-stone-400">
            {isAdvancedOpen ? '▼' : '▶'}
          </span>
        </summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <ConfigCard title="Position Filters">
            <PositionFilters
              selected={config.positions}
              onChange={(positions) =>
                updateConfig({ positions: positions as typeof config.positions })
              }
            />
          </ConfigCard>
          <ConfigCard title="Pot Type Filters">
            <PotTypeFilters
              selected={config.potTypes}
              onChange={(potTypes) =>
                updateConfig({ potTypes: potTypes as typeof config.potTypes })
              }
            />
          </ConfigCard>
        </div>
      </details>

      {/* Start Training */}
      <div className="space-y-2">
        {!canStart && (
          <p className="text-sm text-red-500">
            Select at least one position and pot type
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="button"
          disabled={!canStart || isStarting}
          onClick={handleStartTraining}
          className="rounded bg-stone-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          {isStarting ? 'Starting...' : 'Start Training'}
        </button>
      </div>
    </div>
  );
}
