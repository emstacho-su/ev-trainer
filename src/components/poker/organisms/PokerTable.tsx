import { cn } from '@/lib/utils';
import { PlayerSeat } from '../molecules/PlayerSeat';
import { CommunityCards } from '../molecules/CommunityCards';
import { PotDisplay } from '../molecules/PotDisplay';
import { DealerButton } from '../atoms/DealerButton';
import { Chip } from '../atoms/Chip';

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

// Outer ring: player seats (outside the table felt)
// Positions are % of the container. Players sit around the perimeter.
// Standard poker layout: hero (BB) at bottom center
const SEAT_POSITIONS_6MAX: Record<string, { top: string; left: string }> = {
  BB:  { top: '85%', left: '50%' },   // bottom center (hero)
  SB:  { top: '75%', left: '82%' },   // bottom right
  BTN: { top: '30%', left: '88%' },   // right
  CO:  { top: '10%', left: '68%' },   // top right
  HJ:  { top: '10%', left: '32%' },   // top left
  UTG: { top: '30%', left: '12%' },   // left
};

const SEAT_POSITIONS_9MAX: Record<string, { top: string; left: string }> = {
  BB:    { top: '85%', left: '50%' },   // bottom center
  SB:    { top: '80%', left: '78%' },   // bottom right
  BTN:   { top: '55%', left: '90%' },   // right
  CO:    { top: '25%', left: '85%' },   // upper right
  HJ:    { top: '8%',  left: '68%' },   // top right
  MP:    { top: '8%',  left: '32%' },   // top left
  'UTG+2': { top: '25%', left: '15%' }, // upper left
  'UTG+1': { top: '55%', left: '10%' }, // left
  UTG:   { top: '80%', left: '22%' },   // bottom left
};

// Inner ring: bet chips (between player and table center)
// Offset ~30-35% toward center from seat position
const BET_POSITIONS_6MAX: Record<string, { top: string; left: string }> = {
  BB:  { top: '68%', left: '50%' },
  SB:  { top: '62%', left: '68%' },
  BTN: { top: '38%', left: '72%' },
  CO:  { top: '25%', left: '62%' },
  HJ:  { top: '25%', left: '38%' },
  UTG: { top: '38%', left: '28%' },
};

const BET_POSITIONS_9MAX: Record<string, { top: string; left: string }> = {
  BB:    { top: '68%', left: '50%' },
  SB:    { top: '65%', left: '65%' },
  BTN:   { top: '50%', left: '72%' },
  CO:    { top: '33%', left: '70%' },
  HJ:    { top: '22%', left: '60%' },
  MP:    { top: '22%', left: '40%' },
  'UTG+2': { top: '33%', left: '30%' },
  'UTG+1': { top: '50%', left: '28%' },
  UTG:   { top: '65%', left: '35%' },
};

// Dealer button: small offset from the player seat toward center
const DEALER_OFFSET_6MAX: Record<string, { top: string; left: string }> = {
  BB:  { top: '78%', left: '44%' },
  SB:  { top: '70%', left: '76%' },
  BTN: { top: '35%', left: '82%' },
  CO:  { top: '15%', left: '62%' },
  HJ:  { top: '15%', left: '38%' },
  UTG: { top: '35%', left: '18%' },
};

const DEALER_OFFSET_9MAX: Record<string, { top: string; left: string }> = {
  BB:    { top: '78%', left: '44%' },
  SB:    { top: '74%', left: '72%' },
  BTN:   { top: '50%', left: '84%' },
  CO:    { top: '28%', left: '80%' },
  HJ:    { top: '12%', left: '62%' },
  MP:    { top: '12%', left: '38%' },
  'UTG+2': { top: '28%', left: '20%' },
  'UTG+1': { top: '50%', left: '16%' },
  UTG:   { top: '74%', left: '28%' },
};

export function PokerTable({
  players,
  communityCards,
  pot,
  dealerPosition,
  tableSize = '6max',
  className,
}: PokerTableProps) {
  const seatPositions = tableSize === '9max' ? SEAT_POSITIONS_9MAX : SEAT_POSITIONS_6MAX;
  const betPositions = tableSize === '9max' ? BET_POSITIONS_9MAX : BET_POSITIONS_6MAX;
  const dealerOffsets = tableSize === '9max' ? DEALER_OFFSET_9MAX : DEALER_OFFSET_6MAX;

  return (
    <div className={cn('relative aspect-[16/10] mx-auto', className)}
      style={{ maxHeight: '100%', maxWidth: '100%', width: 'auto', height: '100%' }}
    >
      {/* Oval table surface */}
      <div className="absolute inset-[12%] bg-[hsl(var(--table-surface))] rounded-[50%] border-[6px] border-[hsl(var(--table-border))] shadow-2xl" />

      {/* Player seats on outer ring */}
      {players.map((player) => {
        const pos = seatPositions[player.position];
        if (!pos) return null;

        return (
          <div
            key={player.position}
            className="absolute z-10"
            style={{
              top: pos.top,
              left: pos.left,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <PlayerSeat
              position={player.position}
              stackBB={player.stackBB}
              cards={player.cards}
              isActive={player.isActive}
              isFolded={player.isFolded}
              isHero={player.isHero}
              showCards={player.showCards}
            />
          </div>
        );
      })}

      {/* Bet chips on inner ring */}
      {players.map((player) => {
        if (!player.bet || player.bet <= 0) return null;
        const pos = betPositions[player.position];
        if (!pos) return null;

        return (
          <div
            key={`bet-${player.position}`}
            className="absolute z-20"
            style={{
              top: pos.top,
              left: pos.left,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Chip amount={player.bet} size="sm" />
          </div>
        );
      })}

      {/* Dealer button */}
      {dealerOffsets[dealerPosition] && (
        <div
          className="absolute z-20"
          style={{
            top: dealerOffsets[dealerPosition].top,
            left: dealerOffsets[dealerPosition].left,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <DealerButton />
        </div>
      )}

      {/* Center: Community cards + Pot */}
      <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-30">
        <CommunityCards cards={communityCards} />
        <PotDisplay amount={pot} />
      </div>
    </div>
  );
}
