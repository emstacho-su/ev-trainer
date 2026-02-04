// src/lib/engine/solverResolver.ts

import { buildCanonicalNodeHash } from "./canonicalHash";
import type { CanonicalNode, CacheKey } from "./nodeTypes";
import { buildCacheKey } from "./nodeTypes";
import type { SolverNodeOutput } from "./solverAdapter";
import { validateSolverNodeOutput } from "./solverAdapter";
import type { NodeCache } from "./nodeCache";

export interface CacheEvent {
  type: "hit" | "miss" | "stale" | "recompute";
  key: CacheKey;
}

export interface SolverResolverDeps {
  cache: NodeCache;
  solve: (node: CanonicalNode) => SolverNodeOutput;
  onCacheEvent?: (event: CacheEvent) => void;
  now?: () => string;
  ttlMs?: number;
}

function assertNodeConsistency(node: CanonicalNode): void {
  if (node.publicState.toAct !== node.toAct) {
    throw new Error("node toAct must match publicState.toAct");
  }
}

export function resolveSolverNode(
  node: CanonicalNode,
  deps: SolverResolverDeps
): { nodeHash: string; output: SolverNodeOutput } {
  assertNodeConsistency(node);
  const nodeHash = buildCanonicalNodeHash(node);
  const key = buildCacheKey(nodeHash, node);
  const nowIso = deps.now ? deps.now() : new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  const cached = deps.cache.get(key);
  if (cached) {
    if (deps.ttlMs !== undefined) {
      const createdAtMs = Date.parse(cached.createdAt);
      const isStale = Number.isFinite(createdAtMs) && nowMs - createdAtMs > deps.ttlMs;
      if (isStale) {
        deps.cache.delete?.(key);
        deps.onCacheEvent?.({ type: "stale", key });
      } else {
        deps.onCacheEvent?.({ type: "hit", key });
        return { nodeHash, output: cached.payload };
      }
    } else {
      deps.onCacheEvent?.({ type: "hit", key });
      return { nodeHash, output: cached.payload };
    }
  }

  deps.onCacheEvent?.({ type: "miss", key });
  deps.onCacheEvent?.({ type: "recompute", key });
  const output = validateSolverNodeOutput(deps.solve(node));

  deps.cache.set({
    key,
    payload: output,
    createdAt: nowIso,
  });

  return { nodeHash, output };
}
