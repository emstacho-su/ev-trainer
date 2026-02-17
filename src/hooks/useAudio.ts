'use client';

import { useState, useEffect, useCallback } from 'react';
import { audioManager } from '@/lib/audio/audioManager';
import type { SoundName } from '@/lib/audio/sounds';

const STORAGE_KEY = 'ev-trainer-audio-enabled';

export interface AudioControls {
  audioEnabled: boolean;
  toggleAudio: () => void;
  playSound: (name: SoundName, volume?: number) => void;
}

export function useAudio(): AudioControls {
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const enabled = stored === 'true';
        setAudioEnabled(enabled);
        audioManager.setEnabled(enabled);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      audioManager.setEnabled(next);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  const playSound = useCallback((name: SoundName, volume?: number) => {
    void audioManager.init().then(() => {
      audioManager.playSound(name, volume);
    });
  }, []);

  return { audioEnabled, toggleAudio, playSound };
}
