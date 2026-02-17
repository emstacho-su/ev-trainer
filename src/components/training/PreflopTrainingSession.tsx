'use client';

import { useState, useEffect } from 'react';
import type { Spot } from '@/lib/engine/spot';
import type { ActionId } from '@/lib/engine/types';
import type { DecisionGrade } from '@/lib/engine/trainingOrchestrator';
import { PokerTable } from '@/components/poker/organisms/PokerTable';
import { ActionPanel } from '@/components/poker/organisms/ActionPanel';
import {
  incrementGuestHandCount,
  isGuestLimitExceeded,
} from '@/lib/v2/guestLimiting';

type UIState = 'idle' | 'submitted' | 'revealed';

interface SessionSnapshot {
  sessionId: string;
  seed: string;
  mode: 'TRAINING' | 'PRACTICE';
  packId: string;
  decisionIndex: number;
  decisionsPerSession: number;
  isComplete: boolean;
  filters: Record<string, unknown>;
}

interface Player {
  position: 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2';
  stackBB: number;
  cards?: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  bet?: number;
  isActive: boolean;
  isFolded: boolean;
  isHero?: boolean;
  showCards?: boolean;
}

// Convert Spot to PokerTable players format
function spotToPlayers(spot: Spot): Player[] {
  const players: Player[] = [];

  for (const position of spot.positions) {
    const isHero = position === spot.heroToAct;
    const isFolded = false; // Preflop training - no folded players shown

    players.push({
      position: position as Player['position'],
      stackBB: spot.stacksBb[position],
      isActive: isHero,
      isFolded,
      isHero,
      showCards: isHero,
    });
  }

  return players;
}

// Parse action history to derive pot type
function derivePotType(history: ActionId[]): 'SRP' | '3BP' | '4BP' | undefined {
  const raiseCount = history.filter(a => a.startsWith('RAISE_') || a.startsWith('BET_')).length;
  if (raiseCount === 0) return 'SRP';
  if (raiseCount === 1) return 'SRP';
  if (raiseCount === 2) return '3BP';
  if (raiseCount >= 3) return '4BP';
  return undefined;
}

// Map ActionId to simple action type
function mapActionId(actionId: ActionId): 'fold' | 'call' | 'raise' {
  if (actionId === 'FOLD') return 'fold';
  if (actionId === 'CALL' || actionId === 'CHECK') return 'call';
  return 'raise'; // BET, RAISE, ALL_IN
}

export default function PreflopTrainingSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seed, setSeed] = useState<string>('');
  const [currentSpot, setCurrentSpot] = useState<Spot | null>(null);
  const [uiState, setUiState] = useState<UIState>('idle');
  const [grade, setGrade] = useState<DecisionGrade | null>(null);
  const [handCount, setHandCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isGuestLimitReached, setIsGuestLimitReached] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<ActionId | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Next hand shortcuts (Space/Enter) - only in revealed state
      if ((e.key === ' ' || e.key === 'Enter') && uiState === 'revealed') {
        e.preventDefault();
        handleNext();
        return;
      }

      // Action shortcuts - only in idle state
      if (uiState !== 'idle' || !currentSpot) return;

      if (e.key === '1' || e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleSubmitAction('FOLD');
      } else if (e.key === '2' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleSubmitAction('CALL');
      } else if (e.key === '3' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        // Find first raise action in available actions
        handleSubmitAction('RAISE_2.5BB'); // Default raise for now
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState, currentSpot]);

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newSeed = Math.random().toString(36).substring(2);
      setSeed(newSeed);

      const response = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: newSeed,
          mode: 'TRAINING',
          packId: 'ev-dev-pack-v1',
          filters: { street: 'PREFLOP' },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.session.sessionId);
      setCurrentSpot(data.spot);
      setHandCount(0);
      setCorrectCount(0);
      setSessionComplete(false);
      setIsGuestLimitReached(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAction = async (actionId: ActionId) => {
    if (!currentSpot || !sessionId || uiState !== 'idle') return;

    setUiState('submitted');
    setSelectedActionId(actionId);
    setIsLoading(true);

    try {
      const response = await fetch('/api/session/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed,
          sessionId,
          spot: currentSpot,
          actionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit action');
      }

      const data = await response.json();

      // Wait 500ms for reveal delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setGrade(data.result);
      setUiState('revealed');

      // Update accuracy tracking
      if (data.result.isBestAction) {
        setCorrectCount(prev => prev + 1);
      }
      setHandCount(prev => prev + 1);

      // For guests: track hand count and check limit
      incrementGuestHandCount();
      if (isGuestLimitExceeded()) {
        setIsGuestLimitReached(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setUiState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    if (!sessionId || uiState !== 'revealed') return;

    setUiState('idle');
    setGrade(null);
    setSelectedActionId(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/session/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed,
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error?.code === 'SESSION_COMPLETE') {
          setSessionComplete(true);
          return;
        }
        throw new Error('Failed to get next hand');
      }

      const data = await response.json();
      setCurrentSpot(data.spot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const accuracy = handCount > 0 ? (correctCount / handCount) * 100 : 0;

  // Build action panel data
  const buildActionPanelData = () => {
    if (!currentSpot) return [];

    const actions: Array<{
      action: 'fold' | 'call' | 'raise';
      label?: string;
      state: 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';
      ev?: number;
      frequency?: number;
    }> = [];

    // Always show Fold, Call, Raise for preflop
    const baseActions: ActionId[] = ['FOLD', 'CALL', 'RAISE_2.5BB'];

    for (const actionId of baseActions) {
      const simpleAction = mapActionId(actionId);
      const isUserChoice = selectedActionId === actionId;

      let state: 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect' = 'idle';
      let ev: number | undefined;
      let frequency: number | undefined;

      if (uiState === 'submitted' && isUserChoice) {
        state = 'selected';
      } else if (uiState === 'revealed' && grade) {
        // Find this action in grade results
        const actionData = grade.allActions?.find(a => mapActionId(a.actionId) === simpleAction);

        if (actionData) {
          ev = actionData.ev;
          frequency = actionData.frequency;
        }

        if (isUserChoice) {
          state = grade.isBestAction ? 'revealed-correct' : 'revealed-incorrect';
        } else {
          state = 'revealed-correct'; // Show all actions in revealed state
        }
      }

      actions.push({
        action: simpleAction,
        label: simpleAction === 'raise' ? 'Raise' : undefined,
        state,
        ev,
        frequency,
      });
    }

    return actions;
  };

  // Start screen
  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-lg p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-white mb-4">Preflop Training</h1>
          <p className="text-gray-400 mb-6">
            Practice preflop decisions and receive immediate GTO feedback.
          </p>
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting...' : 'Start Training'}
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-900/50 text-red-200 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Session complete screen
  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-lg p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-4">Session Complete</h2>
          <div className="space-y-3 text-gray-300 mb-6">
            <p>Hands: {handCount}</p>
            <p>Accuracy: {accuracy.toFixed(1)}%</p>
            <p>Correct Decisions: {correctCount}/{handCount}</p>
          </div>
          <button
            onClick={() => {
              setSessionId(null);
              setCurrentSpot(null);
              setSessionComplete(false);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  // Guest limit modal
  if (isGuestLimitReached) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-lg p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-4">Daily Limit Reached</h2>
          <p className="text-gray-300 mb-6">
            You've played 50 hands today. Sign up for unlimited training!
          </p>
          <div className="space-y-3">
            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Sign Up
            </button>
            <button
              onClick={() => {
                setSessionId(null);
                setCurrentSpot(null);
                setIsGuestLimitReached(false);
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSpot) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const players = spotToPlayers(currentSpot);
  const potType = derivePotType(currentSpot.history);
  const dealerPosition = currentSpot.positions.includes('BTN') ? 'BTN' : currentSpot.positions[0] as Player['position'];

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Info bar */}
      <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
        <div className="flex gap-6">
          <span>Hand #{handCount + 1}</span>
          <span>Accuracy: {accuracy.toFixed(1)}%</span>
          <span>Correct: {correctCount}/{handCount}</span>
        </div>
      </div>

      {/* Table display */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-6xl">
          <PokerTable
            players={players}
            communityCards={[]} // Preflop - no community cards
            pot={currentSpot.potBb}
            potType={potType}
            dealerPosition={dealerPosition}
            tableSize="6max"
            actionHistory={currentSpot.history}
          />
        </div>
      </div>

      {/* Action panel */}
      <div className="p-4">
        <ActionPanel
          actions={buildActionPanelData()}
          onAction={(action) => {
            // Map simple action back to ActionId
            const actionMap: Record<string, ActionId> = {
              fold: 'FOLD',
              call: 'CALL',
              raise: 'RAISE_2.5BB',
            };
            handleSubmitAction(actionMap[action]);
          }}
        />
      </div>

      {/* Next button (only in revealed state) */}
      {uiState === 'revealed' && (
        <div className="p-4 bg-gray-900">
          <button
            onClick={handleNext}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            Next Hand (Space/Enter)
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/50 text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
