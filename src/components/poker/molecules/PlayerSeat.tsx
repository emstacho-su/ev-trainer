import { cn } from '@/lib/utils';
import { Card } from '../atoms/Card';

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

function PlayerAvatar() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-7 h-7 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="11" r="6" stroke="#6b7280" strokeWidth="1.5" fill="#374151" />
      <path
        d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10"
        stroke="#6b7280"
        strokeWidth="1.5"
        fill="#374151"
      />
    </svg>
  );
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
  const hasVisibleCards = cards && cards.length > 0 && !isFolded;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 transition-opacity',
        isFolded && 'opacity-40',
        className
      )}
    >
      {/* Hero: show cards above info box */}
      {isHero && hasVisibleCards && showCards && (
        <div className="flex gap-1">
          {cards!.map((card, i) => (
            <Card key={i} rank={card.rank} suit={card.suit} size="sm" />
          ))}
        </div>
      )}

      {/* Villain: avatar to the left of info box */}
      {!isHero ? (
        <div className="flex items-center gap-1.5">
          <PlayerAvatar />
          <div
            className={cn(
              'flex flex-col items-center rounded-md px-4 py-1.5 min-w-[70px]',
              isActive ? 'bg-gray-700' : 'bg-gray-800',
            )}
          >
            <span className="text-xs font-bold text-white uppercase tracking-wide">
              {position}
            </span>
            <span className="text-sm font-semibold text-gray-300">
              {stackBB.toFixed(1)} BB
            </span>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col items-center rounded-md px-4 py-1.5 min-w-[70px] bg-blue-600 ring-2 ring-blue-400"
        >
          <span className="text-xs font-bold text-white uppercase tracking-wide">
            {position}
          </span>
          <span className="text-sm font-semibold text-gray-300">
            {stackBB.toFixed(1)} BB
          </span>
        </div>
      )}
    </div>
  );
}
