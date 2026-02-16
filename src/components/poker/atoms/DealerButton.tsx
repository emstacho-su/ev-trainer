import { cn } from '@/lib/utils';

interface DealerButtonProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function DealerButton({ size = 'md', className }: DealerButtonProps) {
  return (
    <div
      className={cn(
        'rounded-full bg-[hsl(var(--dealer-button))] border-2 border-gray-800 shadow-md flex items-center justify-center font-bold text-gray-900',
        size === 'sm' && 'w-6 h-6 text-xs',
        size === 'md' && 'w-8 h-8 text-sm',
        className
      )}
    >
      D
    </div>
  );
}
