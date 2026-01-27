// src/lib/engine/rng.ts

export interface SeededRng {
  next(): number;
  nextUint32(): number;
  state(): string;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

class Mulberry32 implements SeededRng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  nextUint32(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) >>> 0;
  }

  next(): number {
    return this.nextUint32() / 4294967296;
  }

  state(): string {
    return this.s.toString(16).padStart(8, "0");
  }
}

export function createSeededRng(seed: string): SeededRng {
  if (typeof seed !== "string" || seed.length === 0) {
    throw new Error("seed must be a non-empty string");
  }
  const hashed = fnv1a32(seed);
  return new Mulberry32(hashed);
}

export function combineSeed(parts: readonly (string | number)[]): string {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("parts must be a non-empty array");
  }
  return parts.map((part) => String(part)).join("|");
}
