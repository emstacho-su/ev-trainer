import { cn } from '@/lib/utils';

interface PotDisplayProps {
  amount: number;
  className?: string;
}

export function PotDisplay({ amount, className }: PotDisplayProps) {
  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <span className="text-xs font-semibold text-gray-400 uppercase">Pot</span>
      <span className="text-2xl font-bold text-white bg-gray-800 px-4 py-2 rounded-lg shadow-md">
        {amount.toFixed(1)} BB
      </span>
    </div>
  );
}
