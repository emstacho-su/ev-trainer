'use client';

import { MotionConfig } from 'motion/react';
import { useAnimationPreferences } from '@/hooks/useAnimationPreferences';

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const { animationsEnabled } = useAnimationPreferences();

  // reducedMotion="user" lets Motion detect OS setting automatically.
  // When user disables animations in app, we override with "always"
  // to suppress all transforms (Motion still allows opacity changes).
  const reducedMotion = !animationsEnabled ? 'always' : 'user';

  return (
    <MotionConfig reducedMotion={reducedMotion}>
      {children}
    </MotionConfig>
  );
}
