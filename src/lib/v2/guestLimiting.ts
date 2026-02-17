/**
 * Guest hand limiting utilities for training sessions.
 * Tracks hands played per day via localStorage with automatic daily reset.
 */

const GUEST_HANDS_PER_DAY = 50;
const STORAGE_KEY = 'guest_training_hands';

interface GuestHandData {
  date: string;   // toDateString() format (e.g., "Sun Feb 16 2026")
  count: number;
}

/**
 * Returns current day's hand count for guest users.
 * Automatically resets count if stored date differs from today.
 *
 * Note: Uses browser's local timezone for day boundary via toDateString().
 * If a guest trains across midnight, the counter will naturally reset mid-session.
 */
export function getGuestHandCount(): number {
  if (typeof window === 'undefined') return 0; // SSR safety

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;

    const data: GuestHandData = JSON.parse(stored);
    const today = new Date().toDateString();

    // Reset count if date changed (new day)
    if (data.date !== today) {
      return 0;
    }

    return data.count;
  } catch (err) {
    // Corrupted data or parsing error - start fresh
    console.warn('Failed to read guest hand count:', err);
    return 0;
  }
}

/**
 * Increments today's hand count for guest users.
 * Creates new day entry if needed, or updates existing count.
 */
export function incrementGuestHandCount(): void {
  if (typeof window === 'undefined') return; // SSR safety

  try {
    const today = new Date().toDateString();
    const currentCount = getGuestHandCount();

    const data: GuestHandData = {
      date: today,
      count: currentCount + 1,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to increment guest hand count:', err);
  }
}

/**
 * Checks if guest user has reached daily hand limit.
 * Returns true if current count >= GUEST_HANDS_PER_DAY (50).
 */
export function isGuestLimitExceeded(): boolean {
  return getGuestHandCount() >= GUEST_HANDS_PER_DAY;
}

/**
 * Manually resets guest hand count.
 * Useful for testing or administrative purposes.
 */
export function resetGuestHandCount(): void {
  if (typeof window === 'undefined') return; // SSR safety

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to reset guest hand count:', err);
  }
}
