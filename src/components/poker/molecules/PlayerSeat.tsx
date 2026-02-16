import { cn } from '@/lib/utils';
import { Card } from '../atoms/Card';
import { CardBack } from '../atoms/CardBack';
import { Chip } from '../atoms/Chip';

interface PlayerSeatProps {
  position: 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2';
  stackBB: number;
  cards?: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  bet?: number;
  isActive: boolean;
  isFolded: boolean;
  isHero?: boolean;
  showCards?: boolean;
  className?: string;
}

export function PlayerSeat({
  position,
  stackBB,
  cards,
  bet,
  isActive,
  isFolded,
  isHero = false,
  showCards = false,
  className,
}: PlayerSeatProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 transition-opacity',
        isFolded && 'opacity-40',
        isHero && 'relative',
        className
      )}
    >
      {/* Hero highlight ring */}
      {isHero && (
        <div className="absolute inset-0 -m-2 rounded-lg border-2 border-blue-500 animate-pulse" />
      )}

      {/* Position label */}
      <span
        className={cn(
          'text-xs font-bold px-2 py-1 rounded-md',
          isActive ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
        )}
      >
        {position}
      </span>

      {/* Cards */}
      {cards && cards.length > 0 && !isFolded && (
        <div className="flex gap-1">
          {showCards ? (
            cards.map((card, i) => (
              <Card key={i} rank={card.rank} suit={card.suit} size="sm" />
            ))
          ) : (
            <>
              <CardBack size="sm" />
              <CardBack size="sm" />
            </>
          )}
        </div>
      )}

      {/* Bet chips */}
      {bet !== undefined && bet > 0 && (
        <Chip amount={bet} size="sm" />
      )}

      {/* Stack size */}
      <span
        className={cn(
          'text-xs font-semibold px-2 py-0.5 rounded-md',
          isActive ? 'bg-gray-800 text-white' : 'bg-gray-600 text-gray-400'
        )}
      >
        {stackBB.toFixed(1)} BB
      </span>
    </div>
  );
}
