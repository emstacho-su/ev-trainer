import { cn } from '@/lib/utils';

interface InfoBarProps {
  potType: 'SRP' | '3BP' | '4BP';
  sessionInfo?: string;
  className?: string;
}

export function InfoBar({ potType, sessionInfo, className }: InfoBarProps) {
  return (
    <div className={cn('bg-gray-900 px-6 py-3 flex justify-between items-center rounded-lg shadow-md', className)}>
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-gray-400 uppercase">Pot Type</span>
        <span className="px-3 py-1 bg-blue-600 text-white rounded-md font-bold text-sm">
          {potType}
        </span>
      </div>
      {sessionInfo && (
        <span className="text-sm text-gray-300 font-medium">{sessionInfo}</span>
      )}
    </div>
  );
}
