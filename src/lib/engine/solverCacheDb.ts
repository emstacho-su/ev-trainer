// src/lib/engine/solverCacheDb.ts
// Client-side solver cache using Dexie (IndexedDB wrapper).

import Dexie, { type Table } from "dexie";
import type { SolverNodeOutput } from "./solverAdapter";

export interface CachedSolverResult {
  canonicalHash: string;
  output: SolverNodeOutput;
  street: string;
  createdAt: number;
  accessedAt: number;
}

class SolverCacheDB extends Dexie {
  solverResults!: Table<CachedSolverResult>;

  constructor() {
    super("EVTrainerSolverCache");
    this.version(1).stores({
      solverResults: "canonicalHash, street, accessedAt",
    });
  }
}

/** Singleton — lazy-initialized on first access. */
let db: SolverCacheDB | null = null;

function getDb(): SolverCacheDB {
  if (!db) {
    db = new SolverCacheDB();
  }
  return db;
}

/**
 * Get a cached solver result from IndexedDB.
 * Returns null on miss or if IndexedDB is unavailable (SSR).
 */
export async function getFromIndexedDB(
  hash: string
): Promise<SolverNodeOutput | null> {
  if (typeof window === "undefined") return null;

  try {
    const entry = await getDb().solverResults.get(hash);
    if (!entry) return null;

    // Update access time (fire-and-forget)
    getDb()
      .solverResults.update(hash, { accessedAt: Date.now() })
      .catch(() => {});

    return entry.output;
  } catch {
    return null;
  }
}

/**
 * Store a solver result in IndexedDB.
 * Fire-and-forget — errors are silently ignored.
 */
export async function setInIndexedDB(
  hash: string,
  street: string,
  output: SolverNodeOutput
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const now = Date.now();
    await getDb().solverResults.put({
      canonicalHash: hash,
      output,
      street,
      createdAt: now,
      accessedAt: now,
    });
  } catch {
    // IndexedDB write failure is non-critical
  }
}

/**
 * Evict stale cache entries older than maxAgeMs.
 * Call periodically or on app startup.
 */
export async function evictStaleEntries(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
): Promise<number> {
  if (typeof window === "undefined") return 0;

  try {
    const cutoff = Date.now() - maxAgeMs;
    return await getDb()
      .solverResults.where("accessedAt")
      .below(cutoff)
      .delete();
  } catch {
    return 0;
  }
}
