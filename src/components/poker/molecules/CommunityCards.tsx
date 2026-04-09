'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { AnimatedCard } from '../atoms/AnimatedCard';
import { ANIM, EASE } from '@/lib/ui/animationTiming';
import { useRef } from 'react';

interface CommunityCardsProps {
  cards: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  className?: string;
}

/**
 * Community cards with staggered deal animation.
 * - Flop (3 cards): staggered deal from center
 * - Turn (4th card): single card slides in
 * - River (5th card): single card slides in
 * Tracks which cards are "new" to only animate fresh additions.
 */
export function CommunityCards({ cards, className }: CommunityCardsProps) {
  const prevCountRef = useRef(0);
  const prevCount = prevCountRef.current;
  prevCountRef.current = cards.length;

  if (cards.length === 0) return null;

  return (
    <div className={cn('flex gap-2 items-center', className)}>
      <AnimatePresence mode="popLayout">
        {cards.map((card, i) => {
          const isNew = i >= prevCount;
          // Flop cards stagger; turn/river are single new cards
          const staggerDelay = isNew ? (i - prevCount) * ANIM.CARD_STAGGER : 0;

          return (
            <motion.div
              key={`${card.rank}${card.suit}-${i}`}
              initial={isNew ? { opacity: 0, scale: 0.3, y: -12 } : false}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              transition={{
                duration: ANIM.CARD_DEAL,
                ease: EASE.OUT,
                delay: staggerDelay,
              }}
            >
              <AnimatedCard
                rank={card.rank}
                suit={card.suit}
                size="md"
                faceUp={true}
                dealDelay={isNew ? staggerDelay : 0}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
