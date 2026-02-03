/**
 * Overview: Builds canonical runtime keys from seed + sessionId.
 * Interacts with: runtime/session stores for deterministic lookup.
 * Importance: Prevents key drift across registry/store boundaries.
 */

// src/lib/runtime/runtimeKey.ts

export function runtimeKeyFrom(seed: string, sessionId: string): string {
  return `${seed}::${sessionId}`;
}
