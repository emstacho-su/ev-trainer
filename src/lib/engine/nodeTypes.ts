// src/lib/engine/nodeTypes.ts

import type { NodeHistory, NodePublicState, SolverRequest } from "./solverAdapter";
import type { Position } from "./types";

export interface ActionAbstraction {
  betSizesBb: number[];
  raiseSizesBb: number[];
  maxRaisesPerStreet: number;
}

export interface CanonicalNode {
  gameVersion: string;
  abstractionVersion: string;
  solverVersion: string;
  publicState: NodePublicState;
  history: NodeHistory;
  toAct: Position;
  abstraction: ActionAbstraction;
  rangeContext?: string;
}

export interface CacheKey {
  nodeHash: string;
  gameVersion: string;
  abstractionVersion: string;
  solverVersion: string;
}

export function buildCacheKey(nodeHash: string, node: CanonicalNode): CacheKey {
  return {
    nodeHash,
    gameVersion: node.gameVersion,
    abstractionVersion: node.abstractionVersion,
    solverVersion: node.solverVersion,
  };
}

export function cacheKeyId(key: CacheKey): string {
  return [key.gameVersion, key.abstractionVersion, key.solverVersion, key.nodeHash].join("|");
}

export function toSolverRequest(node: CanonicalNode): SolverRequest {
  return {
    gameVersion: node.gameVersion,
    abstractionVersion: node.abstractionVersion,
    solverVersion: node.solverVersion,
    publicState: node.publicState,
    history: node.history,
    toAct: node.toAct,
    rangeContext: node.rangeContext,
  };
}
