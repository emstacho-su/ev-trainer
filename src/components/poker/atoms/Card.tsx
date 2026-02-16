import { cn } from '@/lib/utils';

interface CardProps {
  rank: string;
  suit: 'h' | 'd' | 'c' | 's';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SUIT_SYMBOLS = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const SUIT_COLORS = {
  h: 'text-red-600',
  d: 'text-red-600',
  c: 'text-gray-900',
  s: 'text-gray-900',
};

export function Card({ rank, suit, size = 'md', className }: CardProps) {
  return (
    <div
      className={cn(
        'relative bg-white rounded-lg border-2 border-gray-300 shadow-lg flex flex-col justify-between p-1',
        size === 'sm' && 'w-12 h-16 text-xs',
        size === 'md' && 'w-16 h-24 text-sm',
        size === 'lg' && 'w-20 h-28 text-base',
        className
      )}
    >
      <div className={cn('flex flex-col items-center leading-none', SUIT_COLORS[suit])}>
        <span className="font-bold">{rank}</span>
        <span>{SUIT_SYMBOLS[suit]}</span>
      </div>
      <div className={cn('absolute inset-0 flex items-center justify-center opacity-20', SUIT_COLORS[suit])}>
        <span className="text-5xl">{SUIT_SYMBOLS[suit]}</span>
      </div>
      <div className={cn('flex flex-col items-center leading-none rotate-180 self-end', SUIT_COLORS[suit])}>
        <span className="font-bold">{rank}</span>
        <span>{SUIT_SYMBOLS[suit]}</span>
      </div>
    </div>
  );
}
