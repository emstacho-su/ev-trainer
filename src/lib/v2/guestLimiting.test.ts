import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getGuestHandCount,
  incrementGuestHandCount,
  isGuestLimitExceeded,
  resetGuestHandCount,
} from './guestLimiting';

// Mock localStorage and window for Node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(globalThis, 'window', {
  value: {},
  writable: true,
});

describe('guestLimiting', () => {
  const STORAGE_KEY = 'guest_training_hands';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getGuestHandCount', () => {
    it('returns 0 when no data stored', () => {
      expect(getGuestHandCount()).toBe(0);
    });

    it('returns stored count for current day', () => {
      const today = new Date().toDateString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 25 }));
      expect(getGuestHandCount()).toBe(25);
    });

    it('returns 0 when stored date is different (day boundary reset)', () => {
      const yesterday = new Date(Date.now() - 86400000).toDateString(); // 1 day ago
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: yesterday, count: 45 }));
      expect(getGuestHandCount()).toBe(0);
    });

    it('returns 0 when localStorage contains corrupted data', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json{');
      expect(getGuestHandCount()).toBe(0);
    });
  });

  describe('incrementGuestHandCount', () => {
    it('creates initial entry with count 1', () => {
      incrementGuestHandCount();
      expect(getGuestHandCount()).toBe(1);
    });

    it('increments existing count for same day', () => {
      const today = new Date().toDateString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 10 }));

      incrementGuestHandCount();
      expect(getGuestHandCount()).toBe(11);

      incrementGuestHandCount();
      expect(getGuestHandCount()).toBe(12);
    });

    it('resets to 1 when incrementing on new day', () => {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: yesterday, count: 40 }));

      incrementGuestHandCount();
      expect(getGuestHandCount()).toBe(1);
    });

    it('stores correct date string', () => {
      incrementGuestHandCount();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.date).toBe(new Date().toDateString());
    });
  });

  describe('isGuestLimitExceeded', () => {
    it('returns false when count is below limit', () => {
      const today = new Date().toDateString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 49 }));
      expect(isGuestLimitExceeded()).toBe(false);
    });

    it('returns true when count equals limit (50)', () => {
      const today = new Date().toDateString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 50 }));
      expect(isGuestLimitExceeded()).toBe(true);
    });

    it('returns true when count exceeds limit', () => {
      const today = new Date().toDateString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 51 }));
      expect(isGuestLimitExceeded()).toBe(true);
    });

    it('returns false when no data (new user)', () => {
      expect(isGuestLimitExceeded()).toBe(false);
    });
  });

  describe('resetGuestHandCount', () => {
    it('removes localStorage entry', () => {
      const today = new Date().toDateString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 30 }));

      resetGuestHandCount();
      expect(getGuestHandCount()).toBe(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('does nothing when no data exists', () => {
      resetGuestHandCount();
      expect(getGuestHandCount()).toBe(0);
    });
  });

  describe('day boundary integration', () => {
    it('handles midnight transition correctly', () => {
      // Simulate playing on day 1
      const day1 = 'Sun Feb 16 2026';
      vi.spyOn(Date.prototype, 'toDateString').mockReturnValue(day1);

      incrementGuestHandCount();
      incrementGuestHandCount();
      expect(getGuestHandCount()).toBe(2);

      // Simulate playing after midnight on day 2
      const day2 = 'Mon Feb 17 2026';
      Date.prototype.toDateString = vi.fn().mockReturnValue(day2);

      // Count resets because stored date !== current date
      expect(getGuestHandCount()).toBe(0);

      // New increment starts fresh count for day 2
      incrementGuestHandCount();
      expect(getGuestHandCount()).toBe(1);
    });
  });
});
