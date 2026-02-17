'use client';

import { useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { PokerTable } from '@/components/poker/organisms/PokerTable';
import { ActionPanel } from '@/components/poker/organisms/ActionPanel';
import { SessionControls } from '@/components/poker/organisms/SessionControls';
import { InfoBar } from '@/components/poker/organisms/InfoBar';

type ActionState = 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';

interface HandScenario {
  heroCards: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  communityCards: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  pot: number;
  correctAction: 'fold' | 'call' | 'raise';
  potType: 'SRP' | '3BP' | '4BP';
  evs: Record<string, number>;
  frequencies: Record<string, number>;
}

const MOCK_HANDS: HandScenario[] = [
  {
    heroCards: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'h' }],
    communityCards: [{ rank: 'Q', suit: 's' }, { rank: 'J', suit: 'h' }, { rank: 'T', suit: 'd' }],
    pot: 15.5,
    correctAction: 'raise',
    potType: '3BP',
    evs: { fold: -1.0, call: 0.85, raise: 2.15 },
    frequencies: { fold: 0.0, call: 0.35, raise: 0.65 },
  },
  {
    heroCards: [{ rank: '7', suit: 'h' }, { rank: '2', suit: 'd' }],
    communityCards: [{ rank: 'A', suit: 'c' }, { rank: 'K', suit: 's' }, { rank: 'Q', suit: 'd' }],
    pot: 8.0,
    correctAction: 'fold',
    potType: 'SRP',
    evs: { fold: -0.5, call: -2.30, raise: -4.10 },
    frequencies: { fold: 0.95, call: 0.05, raise: 0.0 },
  },
  {
    heroCards: [{ rank: 'J', suit: 's' }, { rank: 'J', suit: 'd' }],
    communityCards: [{ rank: '8', suit: 'h' }, { rank: '5', suit: 'c' }, { rank: '2', suit: 's' }],
    pot: 12.0,
    correctAction: 'call',
    potType: '3BP',
    evs: { fold: -1.0, call: 1.45, raise: 0.60 },
    frequencies: { fold: 0.05, call: 0.70, raise: 0.25 },
  },
  {
    heroCards: [{ rank: 'A', suit: 'h' }, { rank: 'A', suit: 'd' }],
    communityCards: [],
    pot: 3.5,
    correctAction: 'raise',
    potType: 'SRP',
    evs: { fold: -1.0, call: 1.20, raise: 3.80 },
    frequencies: { fold: 0.0, call: 0.15, raise: 0.85 },
  },
  {
    heroCards: [{ rank: 'K', suit: 'c' }, { rank: 'Q', suit: 'c' }],
    communityCards: [{ rank: '9', suit: 'c' }, { rank: '6', suit: 'c' }, { rank: '2', suit: 'h' }],
    pot: 20.0,
    correctAction: 'raise',
    potType: '4BP',
    evs: { fold: -2.0, call: 1.60, raise: 3.25 },
    frequencies: { fold: 0.0, call: 0.40, raise: 0.60 },
  },
];

export default function TableUIDemo() {
  const { theme, setTheme } = useTheme();
  const [tableSize, setTableSize] = useState<'6max' | '9max'>('6max');
  const [handIndex, setHandIndex] = useState(0);
  const [handNumber, setHandNumber] = useState(1);
  const [sessionActive, setSessionActive] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({
    fold: 'idle',
    call: 'idle',
    raise: 'idle',
  });
  const [revealedEvs, setRevealedEvs] = useState<Record<string, number>>({});
  const [revealedFreqs, setRevealedFreqs] = useState<Record<string, number>>({});

  const hand = MOCK_HANDS[handIndex];

  const resetActions = useCallback(() => {
    setActionStates({ fold: 'idle', call: 'idle', raise: 'idle' });
    setRevealedEvs({});
    setRevealedFreqs({});
  }, []);

  const loadHand = useCallback((index: number) => {
    setHandIndex(index % MOCK_HANDS.length);
    setActionStates({ fold: 'idle', call: 'idle', raise: 'idle' });
    setRevealedEvs({});
    setRevealedFreqs({});
  }, []);

  const handleStart = useCallback(() => {
    setSessionActive(true);
    setHandNumber(1);
    loadHand(0);
  }, [loadHand]);

  const handleNext = useCallback(() => {
    if (!sessionActive) return;
    const next = handIndex + 1;
    setHandNumber((n) => n + 1);
    loadHand(next);
  }, [sessionActive, handIndex, loadHand]);

  const handleRestart = useCallback(() => {
    setSessionActive(true);
    setHandNumber(1);
    loadHand(0);
  }, [loadHand]);

  const handleStop = useCallback(() => {
    setSessionActive(false);
    resetActions();
  }, [resetActions]);

  const handleAction = useCallback((action: 'fold' | 'call' | 'raise') => {
    if (!sessionActive) return;
    // Mark selected
    setActionStates((prev) => ({ ...prev, [action]: 'selected' }));

    // After delay, reveal all with correct/incorrect
    setTimeout(() => {
      const correct = hand.correctAction;
      setActionStates({
        fold: correct === 'fold' ? 'revealed-correct' : 'revealed-incorrect',
        call: correct === 'call' ? 'revealed-correct' : 'revealed-incorrect',
        raise: correct === 'raise' ? 'revealed-correct' : 'revealed-incorrect',
      });
      setRevealedEvs(hand.evs);
      setRevealedFreqs(hand.frequencies);
    }, 600);
  }, [sessionActive, hand]);

  const players6max = [
    { position: 'BTN' as const, stackBB: 98.5, cards: undefined, bet: undefined, isActive: true, isFolded: false, showCards: false },
    { position: 'SB' as const, stackBB: 99.0, cards: undefined, bet: 0.5, isActive: true, isFolded: false, showCards: false },
    { position: 'BB' as const, stackBB: 98.0, cards: sessionActive ? hand.heroCards : undefined, bet: 1.0, isActive: true, isFolded: false, isHero: true, showCards: true },
    { position: 'UTG' as const, stackBB: 100.0, cards: undefined, bet: undefined, isActive: false, isFolded: true, showCards: false },
    { position: 'HJ' as const, stackBB: 100.0, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
    { position: 'CO' as const, stackBB: 95.0, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
  ];

  const players9max = [
    { position: 'BTN' as const, stackBB: 98.5, cards: undefined, bet: undefined, isActive: true, isFolded: false, showCards: false },
    { position: 'SB' as const, stackBB: 99.0, cards: undefined, bet: 0.5, isActive: true, isFolded: false, showCards: false },
    { position: 'BB' as const, stackBB: 98.0, cards: sessionActive ? hand.heroCards : undefined, bet: 1.0, isActive: true, isFolded: false, isHero: true, showCards: true },
    { position: 'UTG' as const, stackBB: 100.0, cards: undefined, bet: undefined, isActive: false, isFolded: true, showCards: false },
    { position: 'UTG+1' as const, stackBB: 100.0, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
    { position: 'MP' as const, stackBB: 97.5, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
    { position: 'HJ' as const, stackBB: 100.0, cards: undefined, bet: undefined, isActive: false, isFolded: true, showCards: false },
    { position: 'CO' as const, stackBB: 95.0, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
    { position: 'UTG+2' as const, stackBB: 99.5, cards: undefined, bet: undefined, isActive: true, isFolded: false, showCards: false },
  ];

  const players = tableSize === '9max' ? players9max : players6max;

  const isRevealed = actionStates.fold.startsWith('revealed');

  return (
    <div className="h-screen bg-[hsl(var(--background))] flex flex-col overflow-hidden">
      {/* Top bar: info bar + demo controls */}
      <div className="flex items-center justify-between px-6 py-2 shrink-0">
        <InfoBar
          potType={sessionActive ? hand.potType : 'SRP'}
          sessionInfo={sessionActive ? `Hand ${handNumber} / ${MOCK_HANDS.length}` : 'Press Start'}
        />
        <div className="flex gap-3">
          <button
            onClick={() => setTableSize(tableSize === '6max' ? '9max' : '6max')}
            className="px-3 py-1.5 bg-blue-700 text-white rounded-md text-sm"
          >
            {tableSize}
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="px-3 py-1.5 bg-gray-700 text-white rounded-md text-sm"
          >
            Theme
          </button>
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 min-h-0 px-4 relative">
        <PokerTable
          players={players}
          communityCards={sessionActive ? hand.communityCards : []}
          pot={sessionActive ? hand.pot : 0}
          dealerPosition="BTN"
          tableSize={tableSize}
          className="h-full max-h-full mx-auto"
        />

      </div>

      {/* Bottom area: session controls + action panel */}
      <div className="px-6 pb-4 pt-2 max-w-3xl mx-auto w-full flex flex-col gap-2 shrink-0">
        <SessionControls
          className="justify-center"
          onStart={handleStart}
          onNext={handleNext}
          onRestart={handleRestart}
          onStop={handleStop}
          disableStart={sessionActive}
          disableNext={!sessionActive || !isRevealed}
        />

        <ActionPanel
          actions={[
            {
              action: 'fold',
              state: sessionActive ? actionStates.fold : 'disabled',
              ev: revealedEvs.fold,
              frequency: revealedFreqs.fold,
            },
            {
              action: 'call',
              label: sessionActive ? `Call ${hand.pot > 10 ? '5' : '2'} BB` : 'Call',
              state: sessionActive ? actionStates.call : 'disabled',
              ev: revealedEvs.call,
              frequency: revealedFreqs.call,
            },
            {
              action: 'raise',
              state: sessionActive ? actionStates.raise : 'disabled',
              ev: revealedEvs.raise,
              frequency: revealedFreqs.raise,
            },
          ]}
          onAction={handleAction}
        />
      </div>
    </div>
  );
}
