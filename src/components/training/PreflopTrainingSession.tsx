'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Spot } from '@/lib/engine/spot';
import type { ActionId, Position } from '@/lib/engine/types';
import type { DecisionGrade } from '@/lib/engine/trainingOrchestrator';
import { PokerTable } from '@/components/poker/organisms/PokerTable';
import { ActionPanel } from '@/components/poker/organisms/ActionPanel';
import {
  incrementGuestHandCount,
  isGuestLimitExceeded,
} from '@/lib/v2/guestLimiting';
import { useAudio } from '@/hooks/useAudio';

type UIState = 'idle' | 'submitted' | 'revealed';

interface Player {
  position: 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2';
  stackBB: number;
  cards?: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  bet?: number;
  isActive: boolean;
  isFolded: boolean;
  isHero?: boolean;
  showCards?: boolean;
  actionLabel?: string;
}

// Preflop action order (first to act → last)
const PREFLOP_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

// Parse action history to map each position's latest action and bet
function parseHistoryActions(spot: Spot): Map<string, { actionId: string; betBb: number }> {
  // Build acting order: positions in this hand (preflop order), excluding hero
  const actingOrder = PREFLOP_ORDER.filter(
    p => spot.positions.includes(p as Position) && p !== spot.heroToAct
  );

  const result = new Map<string, { actionId: string; betBb: number }>();
  const folded = new Set<string>();

  // Track current bet per position (blinds are initial)
  const bets = new Map<string, number>();
  for (const pos of spot.positions) {
    if (pos === 'SB') bets.set(pos, 0.5);
    else if (pos === 'BB') bets.set(pos, 1.0);
    else bets.set(pos, 0);
  }

  let highBet = 1.0;
  let posIdx = 0;

  for (let hIdx = 0; hIdx < spot.history.length; hIdx++) {
    // Find next eligible position (skip folded)
    let found = false;
    for (let attempts = 0; attempts < actingOrder.length; attempts++) {
      const pos = actingOrder[posIdx % actingOrder.length];
      posIdx++;

      if (folded.has(pos)) continue;

      const actionId = spot.history[hIdx];

      if (actionId === 'FOLD') {
        folded.add(pos);
        result.set(pos, { actionId, betBb: 0 });
      } else if (actionId === 'CHECK') {
        result.set(pos, { actionId, betBb: bets.get(pos) ?? 0 });
      } else if (actionId === 'CALL') {
        bets.set(pos, highBet);
        result.set(pos, { actionId, betBb: highBet });
      } else {
        // RAISE_X or BET_X
        const size = parseFloat(actionId.split('_')[1]) || 0;
        bets.set(pos, size);
        highBet = Math.max(highBet, size);
        result.set(pos, { actionId, betBb: size });
      }

      found = true;
      break;
    }

    if (!found) break;
  }

  return result;
}

// Format action label for display
function formatActionLabel(actionId: string): string {
  if (actionId === 'FOLD') return 'Fold';
  if (actionId === 'CHECK') return 'Check';
  if (actionId === 'CALL') return 'Call';
  if (actionId.startsWith('RAISE_')) return 'Raise';
  if (actionId.startsWith('BET_')) return 'Bet';
  return actionId;
}

// Convert Spot to PokerTable players format
function spotToPlayers(spot: Spot, villainPosition?: string): Player[] {
  const players: Player[] = [];
  const actions = parseHistoryActions(spot);

  for (const position of spot.positions) {
    const isHero = position === spot.heroToAct;
    const isVillain = villainPosition ? position === villainPosition : false;
    const action = actions.get(position);
    const hasFolded = action?.actionId === 'FOLD';
    // Non-hero, non-villain positions without history actions are implicitly folded
    // (they folded before the tracked action history began)
    const isImplicitlyFolded = !isHero && !isVillain && !action;
    const isFolded = hasFolded || isImplicitlyFolded;

    // Determine bet to show as chip
    let bet: number | undefined;
    if (isFolded) {
      bet = undefined;
    } else if (action) {
      // Player acted: show their current bet (0 for fold/check means no chip display)
      bet = action.betBb > 0 ? action.betBb : undefined;
    } else {
      // Player hasn't acted yet: show blind bets for SB/BB (even for hero)
      if (position === 'SB') bet = 0.5;
      else if (position === 'BB') bet = 1.0;
    }

    players.push({
      position: position as Player['position'],
      stackBB: spot.stacksBb[position],
      isActive: !isFolded,
      isFolded,
      isHero,
      showCards: isHero,
      bet,
      actionLabel: action ? formatActionLabel(action.actionId) : undefined,
    });
  }

  return players;
}

// Parse action history to derive pot type
function derivePotType(history: ActionId[]): 'SRP' | '3BP' | '4BP' | undefined {
  const raiseCount = history.filter(a => a.startsWith('RAISE_') || a.startsWith('BET_')).length;
  if (raiseCount <= 1) return 'SRP';
  if (raiseCount === 2) return '3BP';
  if (raiseCount >= 3) return '4BP';
  return undefined;
}

// Map ActionId to display label
function actionLabel(actionId: ActionId): string {
  if (actionId === 'FOLD') return 'Fold';
  if (actionId === 'CALL') return 'Call';
  if (actionId === 'CHECK') return 'Check';
  if (actionId === 'RAISE_2.2X') return 'Raise 2.2x';
  if (actionId === 'RAISE_2.5X') return 'Raise 2.5x';
  if (actionId === 'RAISE_3.0X') return 'Raise 3.0x';
  if (actionId.startsWith('RAISE_')) return 'Raise';
  if (actionId.startsWith('BET_')) return 'Bet';
  return actionId;
}

export default function PreflopTrainingSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seed, setSeed] = useState<string>('');
  const [currentSpot, setCurrentSpot] = useState<Spot | null>(null);
  const [currentVillainPosition, setCurrentVillainPosition] = useState<string | null>(null);
  const [uiState, setUiState] = useState<UIState>('idle');
  const [grade, setGrade] = useState<DecisionGrade | null>(null);
  const [handCount, setHandCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isGuestLimitReached, setIsGuestLimitReached] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<ActionId | null>(null);

  const { playSound } = useAudio();
  const playSoundRef = useRef(playSound);
  playSoundRef.current = playSound;

  // Refs for stable keyboard handler access
  const uiStateRef = useRef(uiState);
  const currentSpotRef = useRef(currentSpot);
  const sessionIdRef = useRef(sessionId);
  const seedRef = useRef(seed);
  uiStateRef.current = uiState;
  currentSpotRef.current = currentSpot;
  sessionIdRef.current = sessionId;
  seedRef.current = seed;

  const handleStart = useCallback(async () => {
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
          decisionsPerSession: 10000,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.session.sessionId);
      setCurrentSpot(data.spot);
      setCurrentVillainPosition(data.villainPosition ?? null);
      playSound('card-deal');
      setHandCount(0);
      setCorrectCount(0);
      setSessionComplete(false);
      setIsGuestLimitReached(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [playSound]);

  const handleSubmitAction = useCallback(async (actionId: ActionId) => {
    if (!currentSpotRef.current || !sessionIdRef.current || uiStateRef.current !== 'idle') return;

    setUiState('submitted');
    setSelectedActionId(actionId);
    playSound('chip-slide');
    setIsLoading(true);

    try {
      const response = await fetch('/api/session/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: seedRef.current,
          sessionId: sessionIdRef.current,
          spot: currentSpotRef.current,
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
      playSound(data.result.isBestAction ? 'ev-correct' : 'ev-incorrect');

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
  }, [playSound]);

  const handleNext = useCallback(async () => {
    if (!sessionIdRef.current || uiStateRef.current !== 'revealed') return;

    setUiState('idle');
    setGrade(null);
    setSelectedActionId(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/session/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: seedRef.current,
          sessionId: sessionIdRef.current,
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
      setCurrentVillainPosition(data.villainPosition ?? null);
      playSound('card-deal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [playSound]);

  // Keyboard shortcuts - uses refs so handler never goes stale
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Next hand shortcuts (Space/Enter) - only in revealed state
      if ((e.key === ' ' || e.key === 'Enter') && uiStateRef.current === 'revealed') {
        e.preventDefault();

        // Inline handleNext logic
        if (!sessionIdRef.current || uiStateRef.current !== 'revealed') return;

        setUiState('idle');
        setGrade(null);
        setSelectedActionId(null);
        setIsLoading(true);

        try {
          const response = await fetch('/api/session/next', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seed: seedRef.current,
              sessionId: sessionIdRef.current,
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
          setCurrentVillainPosition(data.villainPosition ?? null);
          playSoundRef.current('card-deal');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
          setIsLoading(false);
        }

        return;
      }

      // Action shortcuts - only in idle state with a spot loaded
      if (uiStateRef.current !== 'idle' || !currentSpotRef.current) return;

      const actionIds: ActionId[] = ['FOLD', 'CALL', 'RAISE_2.2X', 'RAISE_2.5X', 'RAISE_3.0X'];
      const keyNum = parseInt(e.key);
      let actionId: ActionId | null = null;

      if (keyNum >= 1 && keyNum <= actionIds.length) {
        e.preventDefault();
        actionId = actionIds[keyNum - 1];
      }

      if (!actionId) return;

      // Inline handleSubmitAction logic
      if (!currentSpotRef.current || !sessionIdRef.current || uiStateRef.current !== 'idle') return;

      setUiState('submitted');
      setSelectedActionId(actionId);
      playSoundRef.current('chip-slide');
      setIsLoading(true);

      try {
        const response = await fetch('/api/session/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed: seedRef.current,
            sessionId: sessionIdRef.current,
            spot: currentSpotRef.current,
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
        playSoundRef.current(data.result.isBestAction ? 'ev-correct' : 'ev-incorrect');

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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const accuracy = handCount > 0 ? (correctCount / handCount) * 100 : 0;

  // Build action panel data with isUserChoice for ActionButton
  const buildActionPanelData = () => {
    if (!currentSpot) return [];

    const baseActions: ActionId[] = ['FOLD', 'CALL', 'RAISE_2.2X', 'RAISE_2.5X', 'RAISE_3.0X'];

    return baseActions.map((actionId) => {
      const isUserChoice = selectedActionId === actionId;

      let state: 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect' = 'idle';
      let ev: number | undefined;
      let frequency: number | undefined;

      if (uiState === 'submitted') {
        state = isUserChoice ? 'selected' : 'disabled';
      } else if (uiState === 'revealed' && grade) {
        const actionData = grade.allActions?.find(a => a.actionId === actionId);
        if (actionData) {
          ev = actionData.ev;
          frequency = actionData.frequency;
        }
        if (isUserChoice) {
          state = grade.isBestAction ? 'revealed-correct' : 'revealed-incorrect';
        } else {
          state = 'revealed-correct';
        }
      }

      return {
        actionId,
        label: actionLabel(actionId),
        state,
        ev,
        frequency,
        isUserChoice,
      };
    });
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

  const players = spotToPlayers(currentSpot, currentVillainPosition ?? undefined);
  const potType = derivePotType(currentSpot.history);
  const dealerPosition = currentSpot.positions.includes('BTN') ? 'BTN' : currentSpot.positions[0] as Player['position'];

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Info bar */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Hand</span>
              <span className="text-lg font-bold text-white">#{handCount + 1}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Accuracy</span>
              <span className="text-lg font-bold text-blue-400">{accuracy.toFixed(1)}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Correct</span>
              <span className="text-lg font-bold text-green-400">{correctCount}/{handCount}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Position</span>
            <span className="text-sm font-semibold text-gray-300">
              {currentSpot.heroToAct} | {currentSpot.history.length === 0 ? 'RFI' : `${currentSpot.history.length} prior action(s)`}
            </span>
          </div>
        </div>
      </div>

      {/* Table display */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-6xl">
          <PokerTable
            players={players}
            communityCards={[]}
            pot={currentSpot.potBb}
            potType={potType}
            dealerPosition={dealerPosition}
            tableSize="6max"
          />
        </div>
      </div>

      {/* Action panel */}
      <div className="p-4">
        <ActionPanel
          actions={buildActionPanelData()}
          onAction={(actionId) => handleSubmitAction(actionId as ActionId)}
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
