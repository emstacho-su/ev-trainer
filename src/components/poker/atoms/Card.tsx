import { cn } from '@/lib/utils';

interface CardProps {
  rank: string;
  suit: 'h' | 'd' | 'c' | 's';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const isRed = (suit: string) => suit === 'h' || suit === 'd';

export function Card({ rank, suit, size = 'md', className }: CardProps) {
  const red = isRed(suit);

  return (
    <div
      className={cn(
        'relative bg-white rounded-md shadow-md overflow-hidden',
        'border border-gray-200',
        size === 'sm' && 'w-10 h-14',
        size === 'md' && 'w-14 h-20',
        size === 'lg' && 'w-18 h-26',
        className
      )}
    >
      {/* Top-left rank and suit */}
      <div
        className={cn(
          'absolute top-0.5 left-1 flex flex-col items-center leading-none',
          red ? 'text-red-600' : 'text-gray-900',
          size === 'sm' && 'text-[10px]',
          size === 'md' && 'text-xs',
          size === 'lg' && 'text-sm',
        )}
      >
        <span className="font-bold">{rank}</span>
        <span className="-mt-0.5">{SUIT_SYMBOLS[suit]}</span>
      </div>

      {/* Center suit */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          red ? 'text-red-600' : 'text-gray-900',
          size === 'sm' && 'text-lg',
          size === 'md' && 'text-2xl',
          size === 'lg' && 'text-3xl',
        )}
      >
        {SUIT_SYMBOLS[suit]}
      </div>

      {/* Bottom-right rank and suit (inverted) */}
      <div
        className={cn(
          'absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180',
          red ? 'text-red-600' : 'text-gray-900',
          size === 'sm' && 'text-[10px]',
          size === 'md' && 'text-xs',
          size === 'lg' && 'text-sm',
        )}
      >
        <span className="font-bold">{rank}</span>
        <span className="-mt-0.5">{SUIT_SYMBOLS[suit]}</span>
      </div>
    </div>
  );
}
