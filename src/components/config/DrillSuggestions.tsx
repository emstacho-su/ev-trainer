'use client';

/**
 * Overview: Drill suggestions component for the trainer lobby.
 * Interacts with: /api/drills/suggestions endpoint, lobby config state.
 * Importance: Surfaces weakest spots as clickable drill cards to pre-fill lobby filters.
 */

import { useState, useEffect } from 'react';
import type { TrainerConfig } from '@/lib/v2/config/types';

interface DrillSuggestion {
  spotLabel: string;
  accuracy: number;
  avgEvLoss: number;
  positions: string[];
  potTypes: string[];
}

interface DrillSuggestionsProps {
  onSelectDrill: (drill: Partial<TrainerConfig>) => void;
}

export default function DrillSuggestions({ onSelectDrill }: DrillSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<DrillSuggestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      try {
        const token =
          typeof localStorage !== 'undefined'
            ? localStorage.getItem('access_token') ?? ''
            : '';

        const res = await fetch('/api/drills/suggestions', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (cancelled) return;

        if (res.status === 401) {
          setIsGuest(true);
          setSuggestions([]);
        } else if (res.ok) {
          const data: DrillSuggestion[] = await res.json();
          setSuggestions(data);
        } else {
          console.error('Failed to fetch drill suggestions:', res.status);
          setSuggestions([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching drill suggestions:', error);
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (drill: DrillSuggestion) => {
    onSelectDrill({
      positions: drill.positions as TrainerConfig['positions'],
      ...(drill.potTypes.length > 0
        ? { potTypes: drill.potTypes as TrainerConfig['potTypes'] }
        : {}),
    });
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
        <p className="text-sm text-stone-400">Loading suggestions...</p>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
        <h3 className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
          Drill Suggestions
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Sign in to see drill suggestions based on your performance.
        </p>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
        <h3 className="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
          Drill Suggestions
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Play more hands to unlock drill suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-300">
        Drill Suggestions
      </h3>
      {suggestions.map((drill, i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleSelect(drill)}
          className="w-full cursor-pointer rounded border border-stone-200 p-3 text-left transition-colors hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-stone-900 dark:text-stone-100">
              {drill.spotLabel}
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {drill.accuracy.toFixed(0)}% accuracy
            </span>
          </div>
          <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {drill.avgEvLoss > 0 ? `-${drill.avgEvLoss.toFixed(2)}` : drill.avgEvLoss.toFixed(2)} EV/hand
          </div>
        </button>
      ))}
    </div>
  );
}
