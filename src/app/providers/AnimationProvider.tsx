'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { MotionConfig } from 'motion/react';

const STORAGE_KEY = 'ev-trainer-animations-enabled';

interface AnimationPreferences {
  animationsEnabled: boolean;
  prefersReducedMotion: boolean;
  toggleAnimations: () => void;
}

const AnimationContext = createContext<AnimationPreferences>({
  animationsEnabled: true,
  prefersReducedMotion: false,
  toggleAnimations: () => {},
});

export function useAnimationPreferences(): AnimationPreferences {
  return useContext(AnimationContext);
}

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setAnimationsEnabled(stored === 'true');
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleAnimations = () => {
    setAnimationsEnabled(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const reducedMotion = !animationsEnabled ? 'always' as const : 'user' as const;

  return (
    <AnimationContext.Provider value={{ animationsEnabled, prefersReducedMotion, toggleAnimations }}>
      <MotionConfig reducedMotion={reducedMotion}>
        {children}
      </MotionConfig>
    </AnimationContext.Provider>
  );
}
