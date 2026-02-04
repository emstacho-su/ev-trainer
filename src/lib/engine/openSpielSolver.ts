// src/lib/engine/openSpielSolver.ts

import { createHash } from "node:crypto";
import { __internal } from "./canonicalHash";
import type { CanonicalNode } from "./nodeTypes";
import { mockSolve } from "./mockSolver";
import {
  normalizeSolverActionPolicies,
  validateSolverNodeOutput,
  type SolverErrorV2,
  type SolverNodeOutput,
  type SolverNodeRequestV2,
  type SolverNodeResponseV2,
} from "./solverAdapter";

export type OpenSpielIntegrationMode = "service" | "wasm" | "hybrid";

export interface OpenSpielTransport {
  solve(request: SolverNodeRequestV2, options: { timeoutMs: number }): SolverNodeResponseV2 | SolverErrorV2;
}

export interface OpenSpielSolveConfig {
  mode?: OpenSpielIntegrationMode;
  timeoutMs?: number;
  now?: () => string;
  transport?: OpenSpielTransport;
}

const DEFAULT_TIMEOUT_MS = 1000;

function mapStreet(street: CanonicalNode["publicState"]["street"]): SolverNodeRequestV2["state"]["street"] {
  return street.toLowerCase() as SolverNodeRequestV2["state"]["street"];
}

function inferVillainPosition(heroPosition: string): string {
  if (heroPosition === "BTN") return "BB";
  if (heroPosition === "BB") return "BTN";
  return "BB";
}

function parseAction(actionId: string, potBb: number): {
  action: "fold" | "check" | "call" | "bet" | "raise";
  sizeBb?: number;
} {
  if (actionId === "FOLD") return { action: "fold" };
  if (actionId === "CHECK") return { action: "check" };
  if (actionId === "CALL") return { action: "call" };

  if (actionId.startsWith("BET_") || actionId.startsWith("RAISE_")) {
    const isRaise = actionId.startsWith("RAISE_");
    const suffix = actionId.replace(isRaise ? "RAISE_" : "BET_", "");
    if (suffix.endsWith("PCT")) {
      const pct = Number(suffix.replace("PCT", ""));
      if (Number.isFinite(pct) && pct > 0) {
        return { action: isRaise ? "raise" : "bet", sizeBb: (potBb * pct) / 100 };
      }
    }
    if (suffix.endsWith("BB")) {
      const bb = Number(suffix.replace("BB", ""));
      if (Number.isFinite(bb) && bb > 0) {
        return { action: isRaise ? "raise" : "bet", sizeBb: bb };
      }
    }
    return { action: isRaise ? "raise" : "bet" };
  }

  return { action: "check" };
}

function normalizeRequestBoard(board: string[]): string[] {
  return [...board].map((card) => card.trim()).sort();
}

function buildOpenSpielHashPayload(node: CanonicalNode): Omit<SolverNodeRequestV2, "nodeHash"> {
  const heroPosition = node.toAct;
  const villainPosition = inferVillainPosition(heroPosition);
  return {
    provider: "openspiel",
    context: {
      gameVersion: node.gameVersion,
      abstractionVersion: node.abstractionVersion,
      solverVersion: node.solverVersion,
      evUnit: "bb_per_hand",
    },
    state: {
      street: mapStreet(node.publicState.street),
      board: normalizeRequestBoard(node.publicState.board),
      potBb: node.publicState.potBb,
      effectiveStackBb: node.publicState.effectiveStackBb,
      heroPosition,
      villainPosition,
      toAct: "hero",
    },
    actionHistory: node.history.actions.map((actionId, index) => {
      const parsed = parseAction(actionId, node.publicState.potBb);
      return {
        actor: index % 2 === 0 ? "hero" : "villain",
        action: parsed.action,
        ...(parsed.sizeBb === undefined ? {} : { sizeBb: parsed.sizeBb }),
      };
    }),
  };
}

export function buildOpenSpielRequestNodeHash(node: CanonicalNode): string {
  const payload = buildOpenSpielHashPayload(node);
  const canonicalJson = __internal.stableStringify(payload);
  return createHash("sha256").update(canonicalJson).digest("hex");
}

export function mapCanonicalNodeToOpenSpielRequest(
  node: CanonicalNode,
  nodeHash = buildOpenSpielRequestNodeHash(node)
): SolverNodeRequestV2 {
  const payload = buildOpenSpielHashPayload(node);

  return {
    nodeHash,
    ...payload,
  };
}

function defaultOpenSpielTransport(node: CanonicalNode, now: () => string): OpenSpielTransport {
  return {
    solve(request: SolverNodeRequestV2): SolverNodeResponseV2 {
      const out = mockSolve(node);
      return {
        provider: "openspiel",
        nodeHash: request.nodeHash,
        actions: out.actions.map((action) => ({
          actionId: action.actionId,
          ...parseAction(action.actionId, request.state.potBb),
          frequency: action.frequency,
          ev: action.ev,
        })),
        meta: {
          source: "live",
          solveMs: 1,
          solvedAt: now(),
        },
      };
    },
  };
}

function asSolverError(result: SolverNodeResponseV2 | SolverErrorV2): SolverErrorV2 | null {
  if ((result as SolverErrorV2).ok === false) {
    return result as SolverErrorV2;
  }
  return null;
}

function errorToNodeOutput(nodeHash: string, error: SolverErrorV2): SolverNodeOutput {
  return {
    status: error.code === "UNSUPPORTED_NODE" ? "unsolved" : "error",
    units: "bb",
    actions: [],
    nodeId: `openspiel:${nodeHash}`,
    meta: {
      provider: "openspiel",
      source: "live",
      nodeHash,
      errorCode: error.code,
      retriable: error.retriable,
      errorMessage: error.message,
    },
  };
}

export function normalizeOpenSpielResponse(
  response: SolverNodeResponseV2,
  request: SolverNodeRequestV2
): SolverNodeResponseV2 {
  const normalizedActions = normalizeSolverActionPolicies(response.actions);
  return {
    provider: "openspiel",
    nodeHash: request.nodeHash,
    actions: normalizedActions,
    meta: {
      source: response.meta.source,
      solveMs: response.meta.solveMs,
      solvedAt: response.meta.solvedAt,
    },
  };
}

export function openSpielSolve(node: CanonicalNode, config: OpenSpielSolveConfig = {}): SolverNodeOutput {
  const mode = config.mode ?? "service";
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = config.now ?? (() => new Date().toISOString());
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("openSpiel timeoutMs must be a positive number");
  }

  const nodeHash = buildOpenSpielRequestNodeHash(node);
  const request = mapCanonicalNodeToOpenSpielRequest(node, nodeHash);
  const transport = config.transport ?? defaultOpenSpielTransport(node, now);

  const started = Date.now();
  const result = transport.solve(request, { timeoutMs });
  const elapsed = Date.now() - started;
  if (elapsed > timeoutMs) {
    return errorToNodeOutput(nodeHash, {
      ok: false,
      code: "SOLVER_TIMEOUT",
      message: `OpenSpiel ${mode} solve exceeded timeout (${elapsed}ms > ${timeoutMs}ms)`,
      provider: "openspiel",
      nodeHash,
      retriable: true,
    });
  }

  const error = asSolverError(result);
  if (error) {
    return errorToNodeOutput(nodeHash, {
      ...error,
      provider: "openspiel",
      nodeHash,
    });
  }

  const normalized = normalizeOpenSpielResponse(result as SolverNodeResponseV2, request);
  return validateSolverNodeOutput({
    status: "ok",
    units: "bb",
    actions: normalized.actions.map((action) => ({
      actionId: action.actionId,
      frequency: action.frequency,
      ev: action.ev,
    })),
    nodeId: `openspiel:${nodeHash}`,
    meta: {
      provider: "openspiel",
      source: normalized.meta.source,
      solveMs: normalized.meta.solveMs,
      solvedAt: normalized.meta.solvedAt,
      nodeHash,
    },
  });
}
