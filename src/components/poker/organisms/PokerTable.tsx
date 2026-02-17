'use client';

import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ANIM, EASE } from '@/lib/ui/animationTiming';
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
  heroPosition?: 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2';
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

/**
 * Build position map with optional rotation so `heroPos` sits at the bottom.
 * When heroPos is provided, the seat angles are shifted so that position
 * lands at -90° (visual bottom), keeping relative order intact.
 */
function buildPositions(
  seatOrder: readonly string[],
  rx: number,
  ry: number,
  heroPos?: string,
): Record<string, { top: string; left: string }> {
  const count = seatOrder.length;
  // How many slots to rotate so hero ends up at index 0 (bottom)
  const heroIdx = heroPos ? seatOrder.indexOf(heroPos) : 0;
  const rotationOffset = heroIdx > 0 ? heroIdx * (360 / count) : 0;

  const result: Record<string, { top: string; left: string }> = {};
  for (let i = 0; i < count; i++) {
    const angle = -90 - (i * 360) / count + rotationOffset;
    result[seatOrder[i]] = ellipsePos(angle, rx, ry);
  }
  return result;
}

function buildDealerPositions(
  seatOrder: readonly string[],
  heroPos?: string,
): Record<string, { top: string; left: string }> {
  const count = seatOrder.length;
  const heroIdx = heroPos ? seatOrder.indexOf(heroPos) : 0;
  const rotationOffset = heroIdx > 0 ? heroIdx * (360 / count) : 0;

  const result: Record<string, { top: string; left: string }> = {};
  for (let i = 0; i < count; i++) {
    const angle = -90 - (i * 360) / count + rotationOffset + 15;
    result[seatOrder[i]] = ellipsePos(angle, DEALER_RX, DEALER_RY);
  }
  return result;
}

export function PokerTable({
  players,
  communityCards,
  pot,
  potType,
  dealerPosition,
  heroPosition,
  tableSize = '6max',
  className,
}: PokerTableProps) {
  const seatOrder = tableSize === '9max' ? SEAT_ORDER_9MAX : SEAT_ORDER_6MAX;
  const seatPositions = buildPositions(seatOrder, SEAT_RX, SEAT_RY, heroPosition);
  const betPositions = buildPositions(seatOrder, BET_RX, BET_RY, heroPosition);
  const dealerOffsets = buildDealerPositions(seatOrder, heroPosition);

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
      <AnimatePresence>
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
              <motion.div
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3, transition: { duration: ANIM.CHIP_COLLECT, ease: EASE.OUT } }}
                transition={{ duration: ANIM.CHIP_SLIDE, ease: EASE.OUT }}
              >
                <Chip amount={player.bet} size="sm" />
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>

      {/* Dealer button */}
      {dealerOffsets[dealerPosition] && (
        <motion.div
          layoutId="dealer-button"
          className="absolute z-20"
          style={{
            top: dealerOffsets[dealerPosition].top,
            left: dealerOffsets[dealerPosition].left,
            transform: 'translate(-50%, -50%)',
          }}
          transition={{ layout: { duration: ANIM.DEALER_SLIDE, ease: EASE.OUT } }}
        >
          <DealerButton />
        </motion.div>
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
