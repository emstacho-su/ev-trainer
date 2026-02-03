// src/lib/engine/solverPolicy.ts

import type { SolverProvider } from "./solverAdapter";

const COMMERCIAL_APPROVED_PROVIDERS = new Set<SolverProvider>(["openspiel"]);

export function isCommerciallyApprovedProvider(provider: SolverProvider): boolean {
  return COMMERCIAL_APPROVED_PROVIDERS.has(provider);
}

export function assertCommercialSolverPolicy(
  provider: SolverProvider,
  options?: { legalApproved?: boolean }
): void {
  if (!isCommerciallyApprovedProvider(provider)) {
    throw new Error(`LICENSE_BLOCKED: provider '${provider}' is not commercially approved`);
  }
  if (options?.legalApproved === false) {
    throw new Error(`LICENSE_BLOCKED: provider '${provider}' requires legal approval`);
  }
}

