'use client';

// src/components/poker/organisms/PostflopTrainingSession.tsx
// Main postflop training component integrating PokerTable, StreetActionPanel,
// SpotContextLabel, and the postflop state machine.

import { PostflopSessionProvider, usePostflopSession } from '@/lib/postflop/session/postflopSession';
import { usePostflopTraining } from '@/lib/postflop/hooks/usePostflopTraining';
import { PokerTable } from './PokerTable';
import { StreetActionPanel } from '../molecules/StreetActionPanel';
import { SpotContextLabel } from '../molecules/SpotContextLabel';
import { HandSummaryModal } from '../molecules/HandSummaryModal';
import type { Card } from '@/lib/solver/types';

interface PostflopTrainingSessionProps {
  /** Called when user clicks "Next Hand" in summary modal. */
  onNextHand?: () => void;
  /** Called when user clicks "Replay" in summary modal. */
  onReplay?: () => void;
}

/** Convert Card ('Ah', 'Kc') to PokerTable card format. */
function parseCard(card: Card): { rank: string; suit: 'h' | 'd' | 'c' | 's' } {
  return {
    rank: card.slice(0, -1),
    suit: card.slice(-1) as 'h' | 'd' | 'c' | 's',
  };
}

/** Map IP/OOP to a table seat position for display. */
function positionToSeat(pos: 'IP' | 'OOP'): 'BTN' | 'BB' {
  return pos === 'IP' ? 'BTN' : 'BB';
}

/** Derive pot type from preflopHistory string. */
function derivePotType(preflopHistory: string): '3BP' | 'SRP' | '4BP' {
  const lower = preflopHistory.toLowerCase();
  if (lower.includes('4-bet') || lower.includes('4bet')) return '4BP';
  if (lower.includes('3-bet') || lower.includes('3bet')) return '3BP';
  return 'SRP';
}

/** Derive hero role from preflopHistory. Simplistic: if hero position keyword appears before 'called', hero is aggressor. */
function deriveHeroRole(preflopHistory: string, heroPosition: 'IP' | 'OOP'): 'Aggressor' | 'Caller' {
  const lower = preflopHistory.toLowerCase();
  // Simple heuristic: if 'called' is the last action, the caller is the last actor
  // For IP hero (BTN-like), if history ends with 'called', hero is likely the caller
  if (heroPosition === 'IP' && lower.endsWith('called')) return 'Caller';
  if (heroPosition === 'OOP' && lower.endsWith('called')) return 'Caller';
  // Default: aggressor
  return 'Aggressor';
}

/** Street ordering for deviation comparison. */
const STREET_ORDER = { FLOP: 0, TURN: 1, RIVER: 2 } as const;

function PostflopTrainingSessionInner({ onNextHand, onReplay }: PostflopTrainingSessionProps) {
  const { state, dispatch } = usePostflopSession();
  const { startNewHand, handleUserDecision, isLoading, villainActionLabel, streetActions } = usePostflopTraining();

  const {
    machineState,
    currentStreet,
    board,
    heroHand,
    potBb,
    stackBb,
    heroPosition,
    decisions,
    deviatedStreet,
  } = state;

  // Build players array for PokerTable
  const heroSeat = positionToSeat(heroPosition);
  const villainSeat = positionToSeat(heroPosition === 'IP' ? 'OOP' : 'IP');

  const heroCards = heroHand ? heroHand.map(parseCard) : undefined;

  const players = [
    {
      position: heroSeat as 'BTN' | 'BB',
      stackBB: stackBb,
      cards: heroCards,
      isActive: true,
      isFolded: false,
      isHero: true,
      showCards: true,
    },
    {
      position: villainSeat as 'BTN' | 'BB',
      stackBB: stackBb,
      isActive: true,
      isFolded: false,
      isHero: false,
      showCards: false,
      actionLabel: villainActionLabel ?? undefined,
    },
  ];

  const communityCards = board.map(parseCard);

  // Determine StreetActionPanel props
  const currentDecision = decisions[currentStreet];
  // Use pre-fetched street actions for display; fall back to solver output from decision after reveal
  const solverActions = currentDecision?.solverOutput?.actions ?? streetActions;
  const selectedActionId = currentDecision?.actionId ?? null;

  // Is the current street after a deviation?
  const isDeviated =
    deviatedStreet !== null &&
    STREET_ORDER[currentStreet] > STREET_ORDER[deviatedStreet];

  const isRevealed = machineState === 'evaluating' || machineState === 'advancing' || machineState === 'summary';
  const isDeciding = machineState === 'deciding' && !isLoading;

  // Derive spot context
  const preflopHistory = state.summary?.spot?.preflopHistory ?? 'BTN raised, BB called';
  const potType = derivePotType(preflopHistory);
  const heroRole = deriveHeroRole(preflopHistory, heroPosition);

  // Idle state: show start button
  if (machineState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-bold text-white">Postflop Training</h2>
        <p className="text-gray-400 text-center max-w-md">
          Practice postflop decisions across flop, turn, and river with GTO solver feedback.
        </p>
        <button
          onClick={startNewHand}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          Start Hand
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Street indicator */}
      <div className="flex items-center justify-between px-4 pt-2">
        <div className="flex gap-3">
          {(['FLOP', 'TURN', 'RIVER'] as const).map((street) => (
            <span
              key={street}
              className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded ${
                street === currentStreet
                  ? 'bg-blue-600 text-white'
                  : decisions[street]
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-gray-800 text-gray-500'
              }`}
            >
              {street}
            </span>
          ))}
        </div>
        {deviatedStreet && (
          <span className="text-xs text-orange-400 uppercase tracking-wider">
            Off-line since {deviatedStreet}
          </span>
        )}
      </div>

      {/* Poker table */}
      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
        <div className="w-full max-w-4xl">
          <PokerTable
            players={players}
            communityCards={communityCards}
            pot={potBb}
            dealerPosition="BTN"
            heroPosition={heroSeat}
            tableSize="6max"
          />
        </div>
      </div>

      {/* Villain action overlay */}
      {villainActionLabel && (
        <div className="flex justify-center">
          <div className="bg-gray-800/90 border border-gray-600 rounded-lg px-6 py-3 text-center animate-fade-in">
            <span className="text-sm text-gray-400">Villain:</span>{' '}
            <span className="text-lg font-bold text-white">{villainActionLabel}</span>
          </div>
        </div>
      )}

      {/* Spot context label */}
      <div className="flex justify-center px-4">
        <SpotContextLabel
          heroPosition={heroPosition}
          potType={potType}
          heroRole={heroRole}
          street={currentStreet}
        />
      </div>

      {/* Action panel */}
      {machineState !== 'summary' && (
        <div className="px-4 pb-4">
          <StreetActionPanel
            actions={isDeciding ? solverActions : solverActions}
            selectedActionId={selectedActionId}
            isRevealed={isRevealed}
            isDeviated={isDeviated}
            potBb={potBb}
            onAction={handleUserDecision}
            disabled={!isDeciding}
          />
        </div>
      )}

      {/* Summary modal */}
      {machineState === 'summary' && state.summary && (
        <HandSummaryModal
          summary={state.summary}
          onNextHand={() => {
            dispatch({ type: 'RESET' });
            startNewHand();
            onNextHand?.();
          }}
          onReplay={() => {
            dispatch({ type: 'RESET' });
            onReplay?.();
          }}
        />
      )}
    </div>
  );
}

export function PostflopTrainingSession({ onNextHand, onReplay }: PostflopTrainingSessionProps = {}) {
  return (
    <PostflopSessionProvider>
      <PostflopTrainingSessionInner onNextHand={onNextHand} onReplay={onReplay} />
    </PostflopSessionProvider>
  );
}
