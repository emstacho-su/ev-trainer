import { cn } from '@/lib/utils';

interface ChipProps {
  amount?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Chip({ amount, size = 'md', className }: ChipProps) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      <div
        className={cn(
          'rounded-full bg-[hsl(var(--chip-stack))] border-2 border-white/60 shadow-md',
          size === 'sm' && 'w-5 h-5',
          size === 'md' && 'w-8 h-8',
          size === 'lg' && 'w-12 h-12'
        )}
      />
      {amount !== undefined && (
        <span className="text-[10px] text-white font-semibold whitespace-nowrap">{amount} BB</span>
      )}
    </div>
  );
}
