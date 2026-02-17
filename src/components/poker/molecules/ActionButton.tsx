'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { ANIM, EASE } from '@/lib/ui/animationTiming';

type ActionButtonState = 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect';

function getBarColor(frequency: number | undefined): string {
  if (frequency === undefined) return 'bg-white';
  if (frequency >= 0.6) return 'bg-green-400';
  if (frequency > 0.0) return 'bg-yellow-400';
  return 'bg-red-400';
}

interface ActionButtonProps {
  actionId: string;
  label: string;
  state: ActionButtonState;
  ev?: number;
  frequency?: number;
  isUserChoice?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ActionButton({ actionId: _actionId, label, state, ev, frequency, isUserChoice, onClick, className }: ActionButtonProps) {
  const isRevealed = state.startsWith('revealed');
  const isCorrect = state === 'revealed-correct';
  const isSelected = state === 'selected';

  const revealBg = isCorrect ? '#16a34a' : '#dc2626'; // green-600 / red-600

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <motion.button
        onClick={onClick}
        disabled={state === 'disabled' || isRevealed}
        whileTap={state === 'idle' ? { scale: 0.97 } : undefined}
        animate={isSelected ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={isSelected
          ? { duration: ANIM.BUTTON_PULSE, ease: EASE.IN_OUT, times: [0, 0.5, 1] }
          : { duration: 0.15 }
        }
        className={cn(
          'relative px-4 py-3 rounded-lg font-bold text-base text-white overflow-hidden',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          state === 'idle' && 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500',
          state === 'disabled' && 'bg-gray-800 text-gray-500 cursor-not-allowed',
          state === 'selected' && 'bg-blue-600 ring-2 ring-blue-400',
          isRevealed && 'bg-gray-700',
          isRevealed && isUserChoice && 'ring-2 ring-blue-400',
        )}
      >
        {/* Animated background overlay for reveal color transition */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              key="reveal-bg"
              className="absolute inset-0 rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, backgroundColor: revealBg }}
              exit={{ opacity: 0 }}
              transition={{ duration: ANIM.BUTTON_COLOR, ease: EASE.OUT }}
              style={{ zIndex: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Button content above overlay */}
        <span className="relative z-10 flex items-center gap-2">
          <span>{label}</span>
          <AnimatePresence>
            {isRevealed && ev !== undefined && (
              <motion.span
                key="ev-value"
                className="text-sm font-normal"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: ANIM.EV_REVEAL, ease: EASE.OUT }}
              >
                {ev > 0 ? '+' : ''}{ev.toFixed(2)} BB
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </motion.button>

      {/* Frequency bar — renders instantly, no animation */}
      {isRevealed && frequency !== undefined && (
        <div className="w-full">
          <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn('absolute left-0 top-0 h-full rounded-full', getBarColor(frequency))}
              style={{ width: `${Math.max(frequency * 100, 2)}%` }}
            />
          </div>
          <div className="text-xs text-gray-300 text-center mt-0.5 font-medium">
            {(frequency * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}
