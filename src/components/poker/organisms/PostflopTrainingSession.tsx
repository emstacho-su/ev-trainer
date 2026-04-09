'use client';

// src/components/poker/organisms/PostflopTrainingSession.tsx
// Main postflop training component integrating PokerTable, StreetActionPanel,
// SpotContextLabel, and the postflop state machine.

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ANIM, EASE } from '@/lib/ui/animationTiming';
import { PostflopSessionProvider, usePostflopSession } from '@/lib/postflop/session/postflopSession';
import { usePostflopTraining } from '@/lib/postflop/hooks/usePostflopTraining';
import { loadConfigFromStorage } from '@/lib/v2/config/configStore';
import { PokerTable } from './PokerTable';
import { StreetActionPanel } from '../molecules/StreetActionPanel';
import { SpotContextLabel } from '../molecules/SpotContextLabel';
import { LastRaiserIndicator } from '../molecules/LastRaiserIndicator';
import { HandSummaryModal } from '../molecules/HandSummaryModal';
import { RangeGridModal } from '@/components/range';
import { extractRangeData } from '@/lib/engine/rangeExtractor';
import type { Card } from '@/lib/solver/types';
import type { RangeData } from '@/lib/range/types';

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

const EMPTY_RANGE: RangeData = { hands: [], totalCombos: 0 };

/** Parse "50bb" | "100bb" | "200bb" to numeric value. */
function parseStackDepth(depth: string): number {
  return parseInt(depth.replace('bb', ''), 10);
}

function PostflopTrainingSessionInner({ onNextHand, onReplay }: PostflopTrainingSessionProps) {
  const { state, dispatch } = usePostflopSession();
  const config = useMemo(() => loadConfigFromStorage(), []);
  const targetStackBb = parseStackDepth(config.stackDepth);
  const { startNewHand, handleUserDecision, isLoading, villainActionLabel, streetActions } = usePostflopTraining({ targetStackBb });
  const [rangeModalOpen, setRangeModalOpen] = useState(false);

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

  // Last Raiser Indicator: show at the aggressor's seat
  const aggressorSeat = heroRole === 'Aggressor' ? heroSeat : villainSeat;

  // Range data extracted from solver output for current street
  const solverOutput = currentDecision?.solverOutput;
  const heroRange = useMemo<RangeData>(
    () => solverOutput ? extractRangeData(solverOutput, 'hero') : EMPTY_RANGE,
    [solverOutput],
  );
  const villainRange = useMemo<RangeData>(
    () => solverOutput ? extractRangeData(solverOutput, 'villain') : EMPTY_RANGE,
    [solverOutput],
  );

  // Hero hand in canonical form for highlighting in range grid
  const heroHandCanonical = heroHand
    ? (() => {
        const r1 = heroHand[0].slice(0, -1);
        const r2 = heroHand[1].slice(0, -1);
        const s1 = heroHand[0].slice(-1);
        const s2 = heroHand[1].slice(-1);
        if (r1 === r2) return `${r1}${r2}`;
        return s1 === s2 ? `${r1}${r2}s` : `${r1}${r2}o`;
      })()
    : undefined;

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
      {/* Street indicator — animated highlight */}
      <div className="flex items-center justify-between px-4 pt-2">
        <div className="flex gap-3">
          {(['FLOP', 'TURN', 'RIVER'] as const).map((street) => (
            <motion.span
              key={street}
              animate={{
                backgroundColor: street === currentStreet ? 'rgb(37 99 235)' : decisions[street] ? 'rgb(55 65 81)' : 'rgb(31 41 55)',
                color: street === currentStreet ? 'rgb(255 255 255)' : decisions[street] ? 'rgb(209 213 219)' : 'rgb(107 114 128)',
              }}
              transition={{ duration: 0.2, ease: EASE.OUT }}
              className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded"
            >
              {street}
            </motion.span>
          ))}
        </div>
        <AnimatePresence>
          {deviatedStreet && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: ANIM.EV_REVEAL, ease: EASE.OUT }}
              className="text-xs text-orange-400 uppercase tracking-wider"
            >
              Off-line since {deviatedStreet}
            </motion.span>
          )}
        </AnimatePresence>
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

      {/* Spot context label + LRI */}
      <div className="flex items-center justify-center gap-3 px-4">
        <SpotContextLabel
          heroPosition={heroPosition}
          potType={potType}
          heroRole={heroRole}
          street={currentStreet}
        />
        <LastRaiserIndicator
          seat={aggressorSeat}
          isVisible={true}
        />
      </div>

      {/* View Ranges button (visible after solver reveal) */}
      {isRevealed && solverOutput && (
        <div className="flex justify-center px-4">
          <button
            onClick={() => setRangeModalOpen(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            View Ranges
          </button>
        </div>
      )}

      {/* Action panel — fade transition between streets */}
      <AnimatePresence mode="wait">
        {machineState !== 'summary' && (
          <motion.div
            key={currentStreet}
            className="px-4 pb-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: EASE.OUT }}
          >
            <StreetActionPanel
              actions={isDeciding ? solverActions : solverActions}
              selectedActionId={selectedActionId}
              isRevealed={isRevealed}
              isDeviated={isDeviated}
              potBb={potBb}
              onAction={handleUserDecision}
              disabled={!isDeciding}
            />
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Range visualization modal */}
      <RangeGridModal
        isOpen={rangeModalOpen}
        onClose={() => setRangeModalOpen(false)}
        heroRange={heroRange}
        villainRange={villainRange}
        currentBoard={board}
        currentHand={heroHandCanonical}
      />
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
