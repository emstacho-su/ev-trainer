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
  actionLabel?: string;
}

type TableSize = '6max' | '9max';

interface PokerTableProps {
  players: Player[];
  communityCards: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  pot: number;
  potType?: 'SRP' | '3BP' | '4BP';
  dealerPosition: 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2';
  tableSize?: TableSize;
  className?: string;
}

// Elliptical seat placement for perfect symmetry.
// Center at (50%, 50%). Semi-axes define the ring radius.
// Angle 0 = right, counter-clockwise. BB starts at -90° (bottom).
// Seats go clockwise: BB, SB, BTN, CO, HJ, UTG (6-max)
// or BB, SB, BTN, CO, HJ, MP, UTG+2, UTG+1, UTG (9-max)

function ellipsePos(angleDeg: number, rx: number, ry: number): { top: string; left: string } {
  const rad = (angleDeg * Math.PI) / 180;
  const x = 50 + rx * Math.cos(rad);
  const y = 50 - ry * Math.sin(rad);
  return { left: `${x.toFixed(1)}%`, top: `${y.toFixed(1)}%` };
}

// Seat order clockwise from BB (bottom)
const SEAT_ORDER_6MAX = ['BB', 'SB', 'BTN', 'CO', 'HJ', 'UTG'] as const;
const SEAT_ORDER_9MAX = ['BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'UTG+2', 'UTG+1', 'UTG'] as const;

// Outer ring: seats outside the felt
const SEAT_RX = 42;
const SEAT_RY = 40;

// Inner ring: bet chips (between seats and center)
const BET_RX = 30;
const BET_RY = 28;

// Dealer button ring (closer to center to avoid overlapping seat labels)
const DEALER_RX = 33;
const DEALER_RY = 31;

function buildPositions(seatOrder: readonly string[], rx: number, ry: number): Record<string, { top: string; left: string }> {
  const count = seatOrder.length;
  const result: Record<string, { top: string; left: string }> = {};
  for (let i = 0; i < count; i++) {
    // Start at -90° (bottom), go clockwise (subtract angle)
    const angle = -90 - (i * 360) / count;
    result[seatOrder[i]] = ellipsePos(angle, rx, ry);
  }
  return result;
}

// Dealer button is offset slightly clockwise from the seat position
function buildDealerPositions(seatOrder: readonly string[]): Record<string, { top: string; left: string }> {
  const count = seatOrder.length;
  const result: Record<string, { top: string; left: string }> = {};
  for (let i = 0; i < count; i++) {
    const angle = -90 - (i * 360) / count + 15; // 15° offset toward previous seat
    result[seatOrder[i]] = ellipsePos(angle, DEALER_RX, DEALER_RY);
  }
  return result;
}

const SEAT_POSITIONS_6MAX = buildPositions(SEAT_ORDER_6MAX, SEAT_RX, SEAT_RY);
const SEAT_POSITIONS_9MAX = buildPositions(SEAT_ORDER_9MAX, SEAT_RX, SEAT_RY);

const BET_POSITIONS_6MAX = buildPositions(SEAT_ORDER_6MAX, BET_RX, BET_RY);
const BET_POSITIONS_9MAX = buildPositions(SEAT_ORDER_9MAX, BET_RX, BET_RY);

const DEALER_OFFSET_6MAX = buildDealerPositions(SEAT_ORDER_6MAX);
const DEALER_OFFSET_9MAX = buildDealerPositions(SEAT_ORDER_9MAX);

export function PokerTable({
  players,
  communityCards,
  pot,
  potType,
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
              actionLabel={player.actionLabel}
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

      {/* Center: pot type label, community cards, pot amount */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-30">
        {potType && (
          <span className="px-2.5 py-0.5 bg-gray-900/70 text-gray-300 rounded text-[10px] font-semibold uppercase tracking-wider">
            {potType}
          </span>
        )}
        <CommunityCards cards={communityCards} />
        <PotDisplay amount={pot} />
      </div>
    </div>
  );
}
