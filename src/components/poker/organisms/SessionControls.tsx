import { cn } from '@/lib/utils';

interface SessionControlsProps {
  onStart?: () => void;
  onNext?: () => void;
  onRestart?: () => void;
  onStop?: () => void;
  onViewRanges?: () => void;
  disableStart?: boolean;
  disableNext?: boolean;
  className?: string;
}

export function SessionControls({
  onStart,
  onNext,
  onRestart,
  onStop,
  onViewRanges,
  disableStart = false,
  disableNext = false,
  className,
}: SessionControlsProps) {
  return (
    <div className={cn('flex gap-3', className)}>
      <button
        onClick={onStart}
        disabled={disableStart}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
      >
        Start
      </button>
      <button
        onClick={onNext}
        disabled={disableNext}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
      >
        Next
      </button>
      <button
        onClick={onRestart}
        className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors font-medium"
      >
        Restart
      </button>
      <button
        onClick={onStop}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
      >
        Stop
      </button>
      <button
        onClick={onViewRanges}
        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
      >
        View Ranges
      </button>
    </div>
  );
}
