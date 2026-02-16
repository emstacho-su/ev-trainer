import { cn } from '@/lib/utils';
import { PlayerSeat } from '../molecules/PlayerSeat';
import { CommunityCards } from '../molecules/CommunityCards';
import { PotDisplay } from '../molecules/PotDisplay';
import { DealerButton } from '../atoms/DealerButton';

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

type TableSize = '6max' | '9max';

interface PokerTableProps {
  players: Player[];
  communityCards: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  pot: number;
  dealerPosition: 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2';
  tableSize?: TableSize;
  className?: string;
}

// Seat positions around oval table (percentage-based for responsiveness)
// 6-max positions
const SEAT_POSITIONS_6MAX: Record<string, { top: string; left: string; transform: string }> = {
  BTN: { top: '8%', left: '75%', transform: 'translate(-50%, 0)' },
  SB: { top: '35%', left: '88%', transform: 'translate(-50%, 0)' },
  BB: { top: '65%', left: '75%', transform: 'translate(-50%, 0)' },
  UTG: { top: '65%', left: '25%', transform: 'translate(-50%, 0)' },
  HJ: { top: '35%', left: '12%', transform: 'translate(-50%, 0)' },
  CO: { top: '8%', left: '25%', transform: 'translate(-50%, 0)' },
};

// 9-max positions (distributes 9 seats evenly around oval)
const SEAT_POSITIONS_9MAX: Record<string, { top: string; left: string; transform: string }> = {
  BTN: { top: '10%', left: '75%', transform: 'translate(-50%, 0)' },
  SB: { top: '25%', left: '88%', transform: 'translate(-50%, 0)' },
  BB: { top: '50%', left: '90%', transform: 'translate(-50%, 0)' },
  'UTG': { top: '75%', left: '75%', transform: 'translate(-50%, 0)' },
  'UTG+1': { top: '85%', left: '50%', transform: 'translate(-50%, 0)' },
  'MP': { top: '75%', left: '25%', transform: 'translate(-50%, 0)' },
  'HJ': { top: '50%', left: '10%', transform: 'translate(-50%, 0)' },
  'CO': { top: '25%', left: '12%', transform: 'translate(-50%, 0)' },
  'UTG+2': { top: '10%', left: '25%', transform: 'translate(-50%, 0)' },
};

// Dealer button position (slightly offset from player seat)
const DEALER_BUTTON_OFFSET_6MAX: Record<string, { top: string; left: string }> = {
  BTN: { top: '8%', left: '68%' },
  SB: { top: '35%', left: '81%' },
  BB: { top: '65%', left: '68%' },
  UTG: { top: '65%', left: '32%' },
  HJ: { top: '35%', left: '19%' },
  CO: { top: '8%', left: '32%' },
};

const DEALER_BUTTON_OFFSET_9MAX: Record<string, { top: string; left: string }> = {
  BTN: { top: '10%', left: '68%' },
  SB: { top: '25%', left: '81%' },
  BB: { top: '50%', left: '83%' },
  'UTG': { top: '75%', left: '68%' },
  'UTG+1': { top: '85%', left: '43%' },
  'MP': { top: '75%', left: '32%' },
  'HJ': { top: '50%', left: '17%' },
  'CO': { top: '25%', left: '19%' },
  'UTG+2': { top: '10%', left: '32%' },
};

export function PokerTable({
  players,
  communityCards,
  pot,
  dealerPosition,
  tableSize = '6max',
  className,
}: PokerTableProps) {
  // Select position maps based on table size
  const seatPositions = tableSize === '9max' ? SEAT_POSITIONS_9MAX : SEAT_POSITIONS_6MAX;
  const dealerButtonOffset = tableSize === '9max' ? DEALER_BUTTON_OFFSET_9MAX : DEALER_BUTTON_OFFSET_6MAX;

  return (
    <div className={cn('relative w-full aspect-[16/10] max-w-6xl mx-auto', className)}>
      {/* Oval table surface */}
      <div className="absolute inset-8 bg-[hsl(var(--table-surface))] rounded-[50%] border-8 border-[hsl(var(--table-border))] shadow-2xl" />

      {/* Player seats (absolute positioning) */}
      {players.map((player) => {
        const position = seatPositions[player.position];
        if (!position) return null; // Skip invalid positions for current table size

        return (
          <div
            key={player.position}
            className="absolute z-10"
            style={{
              top: position.top,
              left: position.left,
              transform: position.transform,
            }}
          >
            <PlayerSeat {...player} />
          </div>
        );
      })}

      {/* Dealer button */}
      {dealerButtonOffset[dealerPosition] && (
        <div
          className="absolute z-20"
          style={{
            top: dealerButtonOffset[dealerPosition].top,
            left: dealerButtonOffset[dealerPosition].left,
            transform: 'translate(-50%, 0)',
          }}
        >
          <DealerButton />
        </div>
      )}

      {/* Center: Community cards + Pot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-30">
        <CommunityCards cards={communityCards} />
        <PotDisplay amount={pot} />
      </div>
    </div>
  );
}
