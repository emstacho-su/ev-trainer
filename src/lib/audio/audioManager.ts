import { SOUNDS, type SoundName } from './sounds';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private buffers: Map<SoundName, AudioBuffer> = new Map();
  private enabled = true;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initialized) {
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }
      return;
    }
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    try {
      this.audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      await Promise.allSettled(
        (Object.entries(SOUNDS) as Array<[SoundName, string]>).map(
          ([name, url]) => this._loadSound(name, url)
        )
      );
      this.initialized = true;
    } catch {
      // Audio context creation failed — remain silent
    }
  }

  private async _loadSound(name: SoundName, url: string): Promise<void> {
    if (!this.audioContext) return;
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.buffers.set(name, audioBuffer);
    } catch {
      // File missing or decode error — degrade gracefully
    }
  }

  playSound(name: SoundName, volume = 0.7): void {
    if (!this.enabled || !this.audioContext || !this.initialized) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    try {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      source.buffer = buffer;
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      source.start(0);
    } catch {
      // Playback error — silent
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const audioManager = new AudioManager();
