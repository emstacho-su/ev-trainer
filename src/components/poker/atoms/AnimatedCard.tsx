'use client';

import { motion } from 'motion/react';
import { Card } from './Card';
import { CardBack } from './CardBack';
import { ANIM, EASE } from '@/lib/ui/animationTiming';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  rank: string;
  suit: 'h' | 'd' | 'c' | 's';
  size?: 'sm' | 'md' | 'lg';
  faceUp?: boolean;
  isMucking?: boolean;
  dealDelay?: number;
  className?: string;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-10 h-14',
  md: 'w-14 h-20',
  lg: 'w-18 h-26',
};

export function AnimatedCard({
  rank,
  suit,
  size = 'md',
  faceUp = true,
  isMucking = false,
  dealDelay = 0,
  className,
}: AnimatedCardProps) {
  const sizeClass = SIZE_CLASSES[size];

  // Muck animation target
  const muckTarget = isMucking
    ? { opacity: 0, scale: 0.5, y: -20 }
    : { opacity: 1, scale: 1, y: 0 };

  if (!faceUp) {
    // Villain card: deal entry only (no flip), plus muck
    return (
      <motion.div
        className={cn(sizeClass, className)}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={isMucking ? muckTarget : { opacity: 1, scale: 1 }}
        transition={{
          duration: isMucking ? ANIM.TABLE_RESET : ANIM.CARD_DEAL,
          ease: EASE.OUT,
          delay: isMucking ? 0 : dealDelay,
        }}
      >
        <CardBack size={size} />
      </motion.div>
    );
  }

  // Hero card: deal entry + 3D flip + muck
  return (
    <motion.div
      className={cn(sizeClass, className)}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={isMucking ? muckTarget : { opacity: 1, scale: 1 }}
      transition={{
        duration: isMucking ? ANIM.TABLE_RESET : ANIM.CARD_DEAL,
        ease: EASE.OUT,
        delay: isMucking ? 0 : dealDelay,
      }}
    >
      {/* Perspective wrapper for 3D flip */}
      <div style={{ perspective: '600px' }} className={sizeClass}>
        <motion.div
          style={{
            transformStyle: 'preserve-3d',
            position: 'relative',
          }}
          className={sizeClass}
          initial={{ rotateY: 180 }}
          animate={{ rotateY: 0 }}
          transition={{
            duration: ANIM.CARD_FLIP,
            ease: EASE.IN_OUT,
            delay: dealDelay + ANIM.CARD_DEAL,
          }}
        >
          {/* Front face (Card) — visible when rotateY is 0 */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
            <Card rank={rank} suit={suit} size={size} />
          </div>

          {/* Back face (CardBack) — visible when rotateY is 180 */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
            <CardBack size={size} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
