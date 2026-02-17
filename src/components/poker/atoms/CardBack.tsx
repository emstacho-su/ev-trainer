import { cn } from '@/lib/utils';

interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CardBack({ size = 'md', className }: CardBackProps) {
  return (
    <div
      className={cn(
        'relative rounded-md shadow-md bg-gradient-to-br from-blue-700 to-blue-900',
        'border border-blue-500/30',
        size === 'sm' && 'w-10 h-14',
        size === 'md' && 'w-14 h-20',
        size === 'lg' && 'w-18 h-26',
        className
      )}
    >
      <div className="absolute inset-0 opacity-20 rounded-md overflow-hidden">
        <svg viewBox="0 0 100 140" className="w-full h-full">
          <pattern id="cardback-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="2" fill="white" />
          </pattern>
          <rect width="100" height="140" fill="url(#cardback-pattern)" />
        </svg>
      </div>
    </div>
  );
}
