// src/lib/engine/nodeCache.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SolverNodeOutput } from "./solverAdapter";
import type { CacheKey } from "./nodeTypes";
import { cacheKeyId } from "./nodeTypes";

export interface SolverCacheEntry {
  key: CacheKey;
  payload: SolverNodeOutput;
  createdAt: string;
}

export interface NodeCache {
  get(key: CacheKey): SolverCacheEntry | undefined;
  set(entry: SolverCacheEntry): void;
  delete?(key: CacheKey): void;
}

export class MemoryNodeCache implements NodeCache {
  private readonly maxEntries: number;
  private readonly store = new Map<string, SolverCacheEntry>();

  constructor(maxEntries = 500) {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error("maxEntries must be a positive integer");
    }
    this.maxEntries = maxEntries;
  }

  get(key: CacheKey): SolverCacheEntry | undefined {
    const id = cacheKeyId(key);
    const entry = this.store.get(id);
    if (!entry) return undefined;
    this.store.delete(id);
    this.store.set(id, entry);
    return entry;
  }

  set(entry: SolverCacheEntry): void {
    const id = cacheKeyId(entry.key);
    if (this.store.has(id)) {
      this.store.delete(id);
    }
    this.store.set(id, entry);
    if (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
  }

  delete(key: CacheKey): void {
    this.store.delete(cacheKeyId(key));
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

export class FileNodeCache implements NodeCache {
  private readonly filePath: string;
  private readonly maxEntries: number;
  private store: Record<string, SolverCacheEntry> | null = null;

  constructor(filePath: string, maxEntries = 5000) {
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw new Error("filePath must be a non-empty string");
    }
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error("maxEntries must be a positive integer");
    }
    this.filePath = filePath;
    this.maxEntries = maxEntries;
  }

  get(key: CacheKey): SolverCacheEntry | undefined {
    const id = cacheKeyId(key);
    const store = this.loadStore();
    return store[id];
  }

  set(entry: SolverCacheEntry): void {
    const id = cacheKeyId(entry.key);
    const store = this.loadStore();
    store[id] = entry;
    this.pruneStore(store);
    this.writeStore(store);
  }

  delete(key: CacheKey): void {
    const id = cacheKeyId(key);
    const store = this.loadStore();
    if (!(id in store)) return;
    delete store[id];
    this.writeStore(store);
  }

  private loadStore(): Record<string, SolverCacheEntry> {
    if (this.store) return this.store;
    if (!existsSync(this.filePath)) {
      this.store = {};
      return this.store;
    }
    const raw = readFileSync(this.filePath, "utf-8");
    if (raw.trim().length === 0) {
      this.store = {};
      return this.store;
    }
    const parsed = JSON.parse(raw) as Record<string, SolverCacheEntry>;
    this.store = parsed;
    return parsed;
  }

  private writeStore(store: Record<string, SolverCacheEntry>): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(store), "utf-8");
  }

  private pruneStore(store: Record<string, SolverCacheEntry>): void {
    const ids = Object.keys(store);
    if (ids.length <= this.maxEntries) return;
    ids
      .sort((a, b) => Date.parse(store[a].createdAt) - Date.parse(store[b].createdAt))
      .slice(0, ids.length - this.maxEntries)
      .forEach((id) => {
        delete store[id];
      });
  }
}

export class CompositeNodeCache implements NodeCache {
  private readonly primary: NodeCache;
  private readonly secondary: NodeCache;

  constructor(primary: NodeCache, secondary: NodeCache) {
    this.primary = primary;
    this.secondary = secondary;
  }

  get(key: CacheKey): SolverCacheEntry | undefined {
    const primaryHit = this.primary.get(key);
    if (primaryHit) return primaryHit;
    const secondaryHit = this.secondary.get(key);
    if (secondaryHit) {
      this.primary.set(secondaryHit);
    }
    return secondaryHit;
  }

  set(entry: SolverCacheEntry): void {
    this.primary.set(entry);
    this.secondary.set(entry);
  }

  delete(key: CacheKey): void {
    this.primary.delete?.(key);
    this.secondary.delete?.(key);
  }
}
