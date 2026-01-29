// src/lib/runtime/runtimeKey.ts

export function runtimeKeyFrom(seed: string, sessionId: string): string {
  return `${seed}::${sessionId}`;
}
