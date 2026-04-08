// src/__tests__/trainerConfigDrilling.test.ts
// Integration tests for Phase 7: Trainer Configuration & Drilling.
// Covers config persistence, drilling session creation, and stack depth propagation.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConfigFromStorage, saveConfigToStorage } from '../lib/v2/config/configStore';
import { getDefaultConfig, validateConfig } from '../lib/v2/config/validation';
import { createDrillSession, buildDrillUrl, rankWeakSpots } from '../lib/v2/drilling';
import { generatePostflopHand } from '../lib/postflop/utils/handGenerator';
import type { TrainerConfig } from '../lib/v2/config/types';
import type { WeakSpot } from '../lib/v2/drilling';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ── SC1: Street toggle selects training mode ─────────────────────────

describe('SC1: Street toggle (mode selection)', () => {
  it('default config mode is PREFLOP', () => {
    const config = getDefaultConfig();
    expect(config.mode).toBe('PREFLOP');
  });

  it('config validates FLOP mode', () => {
    const config = validateConfig({ ...getDefaultConfig(), mode: 'FLOP' });
    expect(config).not.toBeNull();
    expect(config!.mode).toBe('FLOP');
  });

  it('config rejects invalid mode', () => {
    const config = validateConfig({ ...getDefaultConfig(), mode: 'INVALID' });
    // validateConfig returns null or applies defaults for invalid values
    if (config) {
      expect(config.mode).toBe('PREFLOP'); // default fallback
    }
  });
});

// ── SC2: Stack depth adjusts solver config ───────────────────────────

describe('SC2: Stack depth selection', () => {
  it('generatePostflopHand uses target stack when provided', () => {
    const spot = generatePostflopHand(100);
    expect(spot.stackBb).toBe(100);
  });

  it('generatePostflopHand uses 50bb target', () => {
    const spot = generatePostflopHand(50);
    expect(spot.stackBb).toBe(50);
  });

  it('generatePostflopHand uses 200bb target', () => {
    const spot = generatePostflopHand(200);
    expect(spot.stackBb).toBe(200);
  });

  it('generatePostflopHand uses random stack when no target', () => {
    const stacks = new Set<number>();
    for (let i = 0; i < 20; i++) {
      stacks.add(generatePostflopHand().stackBb);
    }
    // Should have multiple distinct values (random)
    expect(stacks.size).toBeGreaterThan(1);
  });

  it('config stores stack depth correctly', () => {
    const config: TrainerConfig = { ...getDefaultConfig(), stackDepth: '200bb' };
    saveConfigToStorage(config);
    const loaded = loadConfigFromStorage();
    expect(loaded.stackDepth).toBe('200bb');
  });
});

// ── SC3: Position and pot type filters ───────────────────────────────

describe('SC3: Position and pot type filters', () => {
  it('default config has positions and pot types', () => {
    const config = getDefaultConfig();
    expect(config.positions.length).toBeGreaterThan(0);
    expect(config.potTypes.length).toBeGreaterThan(0);
  });

  it('config persists position filter changes', () => {
    const config: TrainerConfig = { ...getDefaultConfig(), positions: ['BTN', 'CO'] };
    saveConfigToStorage(config);
    const loaded = loadConfigFromStorage();
    expect(loaded.positions).toEqual(['BTN', 'CO']);
  });

  it('config persists pot type filter changes', () => {
    const config: TrainerConfig = { ...getDefaultConfig(), potTypes: ['3BP'] };
    saveConfigToStorage(config);
    const loaded = loadConfigFromStorage();
    expect(loaded.potTypes).toEqual(['3BP']);
  });
});

// ── SC4: Drill specific position matchups from stats ─────────────────

describe('SC4: Drill position matchups', () => {
  it('createDrillSession sets position from weak spot', () => {
    const weakSpot: WeakSpot = {
      heroPosition: 'BB',
      villainPosition: 'BTN',
      street: 'FLOP',
      accuracy: 0.35,
      avgEvLoss: 2.5,
      totalDecisions: 50,
    };

    const drill = createDrillSession(weakSpot);
    expect(drill.config.positions).toEqual(['BB']);
    expect(drill.config.mode).toBe('FLOP');
    expect(drill.urlParams.heroPosition).toBe('BB');
    expect(drill.urlParams.villainPosition).toBe('BTN');
  });

  it('createDrillSession maps PREFLOP street to PREFLOP mode', () => {
    const weakSpot: WeakSpot = {
      heroPosition: 'CO',
      street: 'PREFLOP',
      accuracy: 0.4,
      avgEvLoss: 1.8,
      totalDecisions: 30,
    };

    const drill = createDrillSession(weakSpot);
    expect(drill.config.mode).toBe('PREFLOP');
    expect(drill.config.positions).toEqual(['CO']);
  });

  it('createDrillSession sets handCountTarget to 20', () => {
    const weakSpot: WeakSpot = {
      heroPosition: 'UTG',
      street: 'FLOP',
      accuracy: 0.5,
      avgEvLoss: 1.0,
      totalDecisions: 20,
    };

    const drill = createDrillSession(weakSpot);
    expect(drill.config.handCountTarget).toBe(20);
  });

  it('createDrillSession preserves current config settings', () => {
    const weakSpot: WeakSpot = {
      heroPosition: 'SB',
      street: 'FLOP',
      accuracy: 0.3,
      avgEvLoss: 3.0,
      totalDecisions: 40,
    };

    const drill = createDrillSession(weakSpot, { stackDepth: '200bb', gameType: 'HU' });
    expect(drill.config.stackDepth).toBe('200bb');
    expect(drill.config.gameType).toBe('HU');
  });
});

// ── SC5: Quick-drill button starts targeted session ──────────────────

describe('SC5: Quick-drill URL building', () => {
  it('buildDrillUrl creates correct training URL', () => {
    const weakSpot: WeakSpot = {
      heroPosition: 'BB',
      villainPosition: 'CO',
      street: 'FLOP',
      accuracy: 0.3,
      avgEvLoss: 2.0,
      totalDecisions: 25,
    };

    const drill = createDrillSession(weakSpot);
    const url = buildDrillUrl(drill);
    expect(url).toContain('/training?');
    expect(url).toContain('heroPosition=BB');
    expect(url).toContain('villainPosition=CO');
  });

  it('rankWeakSpots returns worst spots sorted by accuracy', () => {
    const spots: WeakSpot[] = [
      { heroPosition: 'BB', street: 'FLOP', accuracy: 0.7, avgEvLoss: 0.5, totalDecisions: 20 },
      { heroPosition: 'SB', street: 'FLOP', accuracy: 0.3, avgEvLoss: 2.0, totalDecisions: 15 },
      { heroPosition: 'UTG', street: 'PREFLOP', accuracy: 0.5, avgEvLoss: 1.0, totalDecisions: 30 },
      { heroPosition: 'CO', street: 'FLOP', accuracy: 0.2, avgEvLoss: 3.0, totalDecisions: 25 },
      { heroPosition: 'BTN', street: 'FLOP', accuracy: 0.1, avgEvLoss: 4.0, totalDecisions: 5 }, // below min
    ];

    const ranked = rankWeakSpots(spots, 3, 10);
    expect(ranked.length).toBe(3);
    expect(ranked[0].heroPosition).toBe('CO'); // worst accuracy
    expect(ranked[1].heroPosition).toBe('SB');
    expect(ranked[2].heroPosition).toBe('UTG');
    // BTN filtered out (only 5 decisions < minDecisions=10)
    expect(ranked.find((s) => s.heroPosition === 'BTN')).toBeUndefined();
  });
});

// ── SC6: Config persistence across sessions ──────────────────────────

describe('SC6: Config persistence round-trip', () => {
  it('saves and loads config from localStorage', () => {
    const config: TrainerConfig = {
      ...getDefaultConfig(),
      mode: 'FLOP',
      stackDepth: '50bb',
      positions: ['BTN', 'SB', 'BB'],
      potTypes: ['SRP', '3BP'],
      villainAlwaysRaise: true,
    };

    saveConfigToStorage(config);
    const loaded = loadConfigFromStorage();

    expect(loaded.mode).toBe('FLOP');
    expect(loaded.stackDepth).toBe('50bb');
    expect(loaded.positions).toEqual(['BTN', 'SB', 'BB']);
    expect(loaded.potTypes).toEqual(['SRP', '3BP']);
    expect(loaded.villainAlwaysRaise).toBe(true);
  });

  it('returns defaults when localStorage is empty', () => {
    const loaded = loadConfigFromStorage();
    const defaults = getDefaultConfig();
    expect(loaded).toEqual(defaults);
  });

  it('returns defaults when stored config is invalid JSON', () => {
    localStorageMock.getItem.mockReturnValueOnce('not-json');
    const loaded = loadConfigFromStorage();
    expect(loaded).toEqual(getDefaultConfig());
  });

  it('returns defaults when stored config fails validation', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({ mode: 'INVALID' }));
    const loaded = loadConfigFromStorage();
    expect(loaded.mode).toBe('PREFLOP'); // default
  });

  it('handles handCountTarget persistence', () => {
    const config: TrainerConfig = { ...getDefaultConfig(), handCountTarget: 50 };
    saveConfigToStorage(config);
    const loaded = loadConfigFromStorage();
    expect(loaded.handCountTarget).toBe(50);
  });
});
