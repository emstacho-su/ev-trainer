'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { PokerTable } from '@/components/poker/organisms/PokerTable';
import { ActionPanel } from '@/components/poker/organisms/ActionPanel';
import { SessionControls } from '@/components/poker/organisms/SessionControls';
import { InfoBar } from '@/components/poker/organisms/InfoBar';

export default function TableUIDemo() {
  const { theme, setTheme } = useTheme();
  const [actionStates, setActionStates] = useState({
    fold: 'idle' as const,
    call: 'idle' as const,
    raise: 'idle' as const,
  });

  const [tableSize, setTableSize] = useState<'6max' | '9max'>('6max');

  const players6max = [
    { position: 'BTN' as const, stackBB: 98.5, cards: undefined, bet: undefined, isActive: true, isFolded: false, showCards: false },
    { position: 'SB' as const, stackBB: 99.0, cards: undefined, bet: 0.5, isActive: true, isFolded: false, showCards: false },
    { position: 'BB' as const, stackBB: 98.0, cards: [{ rank: 'A', suit: 's' as const }, { rank: 'K', suit: 'h' as const }], bet: 1.0, isActive: true, isFolded: false, isHero: true, showCards: true },
    { position: 'UTG' as const, stackBB: 100.0, cards: undefined, bet: undefined, isActive: false, isFolded: true, showCards: false },
    { position: 'HJ' as const, stackBB: 100.0, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
    { position: 'CO' as const, stackBB: 95.0, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
  ];

  const players9max = [
    { position: 'BTN' as const, stackBB: 98.5, cards: undefined, bet: undefined, isActive: true, isFolded: false, showCards: false },
    { position: 'SB' as const, stackBB: 99.0, cards: undefined, bet: 0.5, isActive: true, isFolded: false, showCards: false },
    { position: 'BB' as const, stackBB: 98.0, cards: [{ rank: 'A', suit: 's' as const }, { rank: 'K', suit: 'h' as const }], bet: 1.0, isActive: true, isFolded: false, isHero: true, showCards: true },
    { position: 'UTG' as const, stackBB: 100.0, cards: undefined, bet: undefined, isActive: false, isFolded: true, showCards: false },
    { position: 'UTG+1' as const, stackBB: 100.0, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
    { position: 'MP' as const, stackBB: 97.5, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
    { position: 'HJ' as const, stackBB: 100.0, cards: undefined, bet: undefined, isActive: false, isFolded: true, showCards: false },
    { position: 'CO' as const, stackBB: 95.0, cards: undefined, bet: 5.0, isActive: true, isFolded: false, showCards: false },
    { position: 'UTG+2' as const, stackBB: 99.5, cards: undefined, bet: undefined, isActive: true, isFolded: false, showCards: false },
  ];

  const players = tableSize === '9max' ? players9max : players6max;

  const communityCards = [
    { rank: 'Q', suit: 's' as const },
    { rank: 'J', suit: 'h' as const },
    { rank: 'T', suit: 'd' as const },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-8">
      <div className="mb-4 flex justify-end gap-3">
        <button
          onClick={() => setTableSize(tableSize === '6max' ? '9max' : '6max')}
          className="px-4 py-2 bg-blue-700 text-white rounded-md"
        >
          Table Size: {tableSize}
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="px-4 py-2 bg-gray-700 text-white rounded-md"
        >
          Toggle Theme ({theme})
        </button>
      </div>

      <InfoBar potType="3BP" sessionInfo="Hand 5 / 20" className="mb-4" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <PokerTable
            players={players}
            communityCards={communityCards}
            pot={15.5}
            dealerPosition="BTN"
            tableSize={tableSize}
          />
        </div>

        <div>
          <ActionPanel
            actions={[
              { action: 'fold', state: actionStates.fold },
              { action: 'call', label: 'Call 5 BB', state: actionStates.call },
              { action: 'raise', state: actionStates.raise },
            ]}
            onAction={(action) => {
              setActionStates({ ...actionStates, [action]: 'selected' });
              setTimeout(() => {
                setActionStates({
                  fold: action === 'fold' ? 'revealed-correct' : 'revealed-incorrect',
                  call: action === 'call' ? 'revealed-incorrect' : 'revealed-incorrect',
                  raise: action === 'raise' ? 'revealed-incorrect' : 'revealed-incorrect',
                });
              }, 1000);
            }}
          />
          <SessionControls className="mt-4" />
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => setActionStates({ fold: 'idle', call: 'idle', raise: 'idle' })}
          className="px-6 py-3 bg-gray-700 text-white rounded-md"
        >
          Reset Action States
        </button>
      </div>
    </div>
  );
}
