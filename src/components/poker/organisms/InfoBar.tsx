import { cn } from '@/lib/utils';

interface InfoBarProps {
  potType: 'SRP' | '3BP' | '4BP';
  sessionInfo?: string;
  className?: string;
}

export function InfoBar({ potType, sessionInfo, className }: InfoBarProps) {
  return (
    <div className={cn('bg-gray-900/90 px-4 py-2 flex items-center gap-6 rounded-lg shadow-md', className)}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-gray-400 uppercase">Pot Type</span>
        <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-md font-bold text-xs">
          {potType}
        </span>
      </div>
      {sessionInfo && (
        <span className="text-xs text-gray-300 font-medium">{sessionInfo}</span>
      )}
    </div>
  );
}
