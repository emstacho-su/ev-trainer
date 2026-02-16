import { cn } from '@/lib/utils';
import { Card } from '../atoms/Card';
import { CardBack } from '../atoms/CardBack';

interface PlayerSeatProps {
  position: 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2';
  stackBB: number;
  cards?: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
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
  isActive,
  isFolded,
  isHero = false,
  showCards = false,
  className,
}: PlayerSeatProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 transition-opacity',
        isFolded && 'opacity-40',
        className
      )}
    >
      {/* Cards */}
      {cards && cards.length > 0 && !isFolded && (
        <div className="flex -space-x-2">
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

      {/* Player info box: position + stack */}
      <div
        className={cn(
          'flex flex-col items-center rounded-md px-3 py-1 min-w-[60px]',
          isHero
            ? 'bg-blue-600 ring-2 ring-blue-400'
            : isActive
              ? 'bg-gray-700'
              : 'bg-gray-800',
        )}
      >
        <span className="text-[10px] font-bold text-white uppercase tracking-wide">
          {position}
        </span>
        <span className="text-xs font-semibold text-gray-300">
          {stackBB.toFixed(1)} BB
        </span>
      </div>
    </div>
  );
}
