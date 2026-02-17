'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ev-trainer-animations-enabled';

export interface AnimationPreferences {
  /** Whether user has animations turned on (default: true) */
  animationsEnabled: boolean;
  /** OS-level prefers-reduced-motion setting */
  prefersReducedMotion: boolean;
  /** Toggle animations on/off and persist to localStorage */
  toggleAnimations: () => void;
}

export function useAnimationPreferences(): AnimationPreferences {
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Load persisted preference (localStorage is client-only)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setAnimationsEnabled(stored === 'true');
    }

    // Detect OS prefers-reduced-motion
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

  return { animationsEnabled, prefersReducedMotion, toggleAnimations };
}
