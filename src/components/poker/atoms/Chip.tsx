import { cn } from '@/lib/utils';

interface ChipProps {
  amount?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Chip({ amount, size = 'md', className }: ChipProps) {
  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div
        className={cn(
          'rounded-full bg-[hsl(var(--chip-stack))] border-4 border-white shadow-lg flex items-center justify-center font-bold text-white',
          size === 'sm' && 'w-8 h-8 text-xs',
          size === 'md' && 'w-12 h-12 text-sm',
          size === 'lg' && 'w-16 h-16 text-base'
        )}
      >
        {amount !== undefined && <span>{amount}</span>}
      </div>
      {amount !== undefined && (
        <span className="text-xs text-white font-semibold">{amount} BB</span>
      )}
    </div>
  );
}
