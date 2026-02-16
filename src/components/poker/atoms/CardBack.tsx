import { cn } from '@/lib/utils';

interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CardBack({ size = 'md', className }: CardBackProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border-2 border-gray-300 shadow-lg bg-gradient-to-br from-blue-700 to-blue-900',
        size === 'sm' && 'w-12 h-16',
        size === 'md' && 'w-16 h-24',
        size === 'lg' && 'w-20 h-28',
        className
      )}
    >
      <div className="absolute inset-0 opacity-30">
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
