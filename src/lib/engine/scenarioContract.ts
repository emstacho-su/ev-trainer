import { createHash } from "node:crypto";
import type { Position, Street } from "./types";
import { Positions, Streets } from "./types";

export type ScenarioSchemaVersion = "scenario.v1";
export type ScenarioMode = "preflop" | "postflop";
export type ScenarioGameType = "cash" | "mtt";
export type ScenarioTableSize = "heads-up" | "6-max" | "9-max";
export type ScenarioVillainBehavior = "gto";
export type ScenarioLineFamily = "open-raise" | "vs-open" | "vs-3bet" | "vs-4bet";

export interface TrainerScenarioConfigV1 {
  schemaVersion: ScenarioSchemaVersion;
  mode: ScenarioMode;
  gameType: ScenarioGameType;
  tableSize: ScenarioTableSize;
  stackDepthBb: 50 | 100 | 200;
  villainBehavior: ScenarioVillainBehavior;
  dealOnlyDecisions: boolean;
}

export interface PreflopScenarioV1 {
  scenarioType: "preflop";
  scenarioId: string;
  lineFamily: ScenarioLineFamily;
  heroPosition: Position;
  villainPosition: Position;
  actionHistory: string[];
}

export interface PostflopScenarioV1 {
  scenarioType: "postflop";
  scenarioId: string;
  pool: {
    poolId: string;
    poolVersion: string;
    entryStreet: Street;
    board: string[];
    boardTextureBucket?: string;
  };
  preflopContext: {
    lineFamily: ScenarioLineFamily;
    heroPosition: Position;
    villainPosition: Position;
    actionHistory: string[];
  };
}

export type TrainerScenarioV1 = PreflopScenarioV1 | PostflopScenarioV1;

export interface DealOnlyDecisionInput {
  legalActionCount: number;
  hasForcedAction: boolean;
  allActionsEquivalent: boolean;
}

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new Error(`${name} must be an object`);
  }
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertBoolean(value: unknown, name: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be a boolean`);
  }
}

function assertPosition(value: unknown, name: string): asserts value is Position {
  assertString(value, name);
  if (!Positions.includes(value as Position)) {
    throw new Error(`${name} must be a supported position`);
  }
}

function assertLineFamily(value: unknown, name: string): asserts value is ScenarioLineFamily {
  assertString(value, name);
  const allowed: ScenarioLineFamily[] = ["open-raise", "vs-open", "vs-3bet", "vs-4bet"];
  if (!allowed.includes(value as ScenarioLineFamily)) {
    throw new Error(`${name} must be a supported lineFamily`);
  }
}

function normalizeCard(card: string): string {
  const raw = card.trim();
  if (raw.length === 3 && raw.startsWith("10")) {
    return `T${raw[2].toLowerCase()}`;
  }
  if (raw.length === 2) {
    return `${raw[0].toUpperCase()}${raw[1].toLowerCase()}`;
  }
  throw new Error(`invalid board card '${card}'`);
}

function normalizeActionHistory(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
  return value.map((action, index) => {
    assertString(action, `${name}[${index}]`);
    return action;
  });
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) throw new Error("cannot stringify undefined");
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? value.toString() : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
  }
  throw new Error(`unsupported type '${typeof value}'`);
}

export function validateTrainerScenarioConfig(input: unknown): TrainerScenarioConfigV1 {
  assertObject(input, "config");
  const config = input as Record<string, unknown>;
  if (config.schemaVersion !== "scenario.v1") {
    throw new Error("config.schemaVersion must be 'scenario.v1'");
  }
  if (config.mode !== "preflop" && config.mode !== "postflop") {
    throw new Error("config.mode must be 'preflop' or 'postflop'");
  }
  if (config.gameType !== "cash" && config.gameType !== "mtt") {
    throw new Error("config.gameType must be 'cash' or 'mtt'");
  }
  if (config.tableSize !== "heads-up" && config.tableSize !== "6-max" && config.tableSize !== "9-max") {
    throw new Error("config.tableSize must be 'heads-up', '6-max', or '9-max'");
  }
  if (config.stackDepthBb !== 50 && config.stackDepthBb !== 100 && config.stackDepthBb !== 200) {
    throw new Error("config.stackDepthBb must be one of 50, 100, 200");
  }
  if (config.villainBehavior !== "gto") {
    throw new Error("config.villainBehavior must be 'gto'");
  }
  assertBoolean(config.dealOnlyDecisions, "config.dealOnlyDecisions");
  return {
    schemaVersion: "scenario.v1",
    mode: config.mode as ScenarioMode,
    gameType: config.gameType as ScenarioGameType,
    tableSize: config.tableSize as ScenarioTableSize,
    stackDepthBb: config.stackDepthBb as 50 | 100 | 200,
    villainBehavior: "gto",
    dealOnlyDecisions: config.dealOnlyDecisions as boolean,
  };
}

export function validateTrainerScenario(input: unknown): TrainerScenarioV1 {
  assertObject(input, "scenario");
  const scenario = input as Record<string, unknown>;
  assertString(scenario.scenarioId, "scenario.scenarioId");
  if (scenario.scenarioType === "preflop") {
    assertLineFamily(scenario.lineFamily, "scenario.lineFamily");
    assertPosition(scenario.heroPosition, "scenario.heroPosition");
    assertPosition(scenario.villainPosition, "scenario.villainPosition");
    const actionHistory = normalizeActionHistory(scenario.actionHistory, "scenario.actionHistory");
    return {
      scenarioType: "preflop",
      scenarioId: scenario.scenarioId,
      lineFamily: scenario.lineFamily as ScenarioLineFamily,
      heroPosition: scenario.heroPosition as Position,
      villainPosition: scenario.villainPosition as Position,
      actionHistory,
    };
  }

  if (scenario.scenarioType === "postflop") {
    assertObject(scenario.pool, "scenario.pool");
    assertObject(scenario.preflopContext, "scenario.preflopContext");
    const pool = scenario.pool as Record<string, unknown>;
    const preflop = scenario.preflopContext as Record<string, unknown>;
    assertString(pool.poolId, "scenario.pool.poolId");
    assertString(pool.poolVersion, "scenario.pool.poolVersion");
    if (!Streets.includes(pool.entryStreet as Street)) {
      throw new Error("scenario.pool.entryStreet must be a supported street");
    }
    if (!Array.isArray(pool.board)) {
      throw new Error("scenario.pool.board must be an array");
    }
    const board = pool.board.map((card, index) => {
      assertString(card, `scenario.pool.board[${index}]`);
      return normalizeCard(card);
    });
    board.sort();

    assertLineFamily(preflop.lineFamily, "scenario.preflopContext.lineFamily");
    assertPosition(preflop.heroPosition, "scenario.preflopContext.heroPosition");
    assertPosition(preflop.villainPosition, "scenario.preflopContext.villainPosition");
    const actionHistory = normalizeActionHistory(
      preflop.actionHistory,
      "scenario.preflopContext.actionHistory"
    );

    const boardTextureBucket = pool.boardTextureBucket;
    if (boardTextureBucket !== undefined) {
      assertString(boardTextureBucket, "scenario.pool.boardTextureBucket");
    }

    return {
      scenarioType: "postflop",
      scenarioId: scenario.scenarioId,
      pool: {
        poolId: pool.poolId as string,
        poolVersion: pool.poolVersion as string,
        entryStreet: pool.entryStreet as Street,
        board,
        ...(boardTextureBucket === undefined ? {} : { boardTextureBucket: boardTextureBucket as string }),
      },
      preflopContext: {
        lineFamily: preflop.lineFamily as ScenarioLineFamily,
        heroPosition: preflop.heroPosition as Position,
        villainPosition: preflop.villainPosition as Position,
        actionHistory,
      },
    };
  }

  throw new Error("scenario.scenarioType must be 'preflop' or 'postflop'");
}

export function shouldIncludeDecisionForDealOnly(
  config: Pick<TrainerScenarioConfigV1, "dealOnlyDecisions">,
  decision: DealOnlyDecisionInput
): boolean {
  if (!config.dealOnlyDecisions) return true;
  return (
    Number.isInteger(decision.legalActionCount) &&
    decision.legalActionCount >= 2 &&
    !decision.hasForcedAction &&
    !decision.allActionsEquivalent
  );
}

export function computeScenarioRegenerationKey(
  config: TrainerScenarioConfigV1,
  scenario: TrainerScenarioV1
): string {
  const canonical = stableStringify({
    config,
    scenario,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
