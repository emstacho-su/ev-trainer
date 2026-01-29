// src/lib/engine/action.ts

import type { ActionId, ActionType } from "./types";

export interface Action {
  type: ActionType;
  sizeBb?: number;
}

const SIZE_EPS = 1e-9;

function assertFinitePositive(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number > 0`);
  }
}

function assertUndefined(value: unknown, name: string): void {
  if (value !== undefined) {
    throw new Error(`${name} must be undefined for non-sized actions`);
  }
}

function formatSizeBb(sizeBb: number): string {
  if (!Number.isFinite(sizeBb)) throw new Error("sizeBb must be finite");
  const normalized = Math.abs(sizeBb) < SIZE_EPS ? 0 : sizeBb;
  return normalized.toString();
}

// Validates Action shape and sizing rules (bb).
export function validateAction(action: Action): Action {
  if (action === null || typeof action !== "object") {
    throw new Error("action must be an object");
  }

  switch (action.type) {
    case "FOLD":
    case "CHECK":
    case "CALL":
      assertUndefined(action.sizeBb, "sizeBb");
      break;
    case "BET":
    case "RAISE":
      assertFinitePositive(action.sizeBb, "sizeBb");
      break;
    case "ALL_IN":
      if (action.sizeBb !== undefined) {
        assertFinitePositive(action.sizeBb, "sizeBb");
      }
      break;
    default:
      throw new Error(`unsupported action type: ${String(action.type)}`);
  }

  return action;
}

// Converts Action into a stable ActionId string.
export function actionToId(action: Action): ActionId {
  validateAction(action);
  switch (action.type) {
    case "FOLD":
    case "CHECK":
    case "CALL":
      return action.type;
    case "BET":
    case "RAISE":
    case "ALL_IN": {
      if (action.sizeBb === undefined) {
        return action.type;
      }
      return `${action.type}_${formatSizeBb(action.sizeBb)}BB`;
    }
  }
}

// Parses an ActionId string into an Action.
export function idToAction(actionId: ActionId): Action {
  if (typeof actionId !== "string" || actionId.length === 0) {
    throw new Error("actionId must be a non-empty string");
  }

  const [typeRaw, sizeRaw] = actionId.split("_");
  const type = typeRaw as ActionType;

  if (!sizeRaw) {
    return validateAction({ type });
  }

  if (!sizeRaw.endsWith("BB")) {
    throw new Error("sized actionId must end with 'BB'");
  }
  const sizeValue = sizeRaw.slice(0, -2);
  const parsed = Number.parseFloat(sizeValue);
  if (!Number.isFinite(parsed)) {
    throw new Error("actionId size must be a finite number");
  }

  return validateAction({ type, sizeBb: parsed });
}
