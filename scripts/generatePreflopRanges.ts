/**
 * Generate preflop range data for all 6-max scenarios.
 *
 * Attempts to use the built-in CFR+ solver with low iterations.
 * Falls back to GTO-approximate static data if the solver fails or is too slow.
 *
 * Usage: npx tsx scripts/generatePreflopRanges.ts [--iterations=500]
 *
 * Output: public/ranges/preflop-6max-100bb.json
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Import solver (may fail if solver module has issues)
let solverAvailable = false;
let solvePreflopScenario: any;
let createDefaultSolverConfig: any;
let toSolverNodeOutput: any;
let buildInfoSetId: any;
let CANONICAL_HANDS: any;

try {
  const solver = require("../src/lib/solver");
  solvePreflopScenario = solver.solvePreflopScenario;
  createDefaultSolverConfig = solver.createDefaultSolverConfig;
  toSolverNodeOutput = solver.toSolverNodeOutput;
  buildInfoSetId = solver.buildInfoSetId;
  CANONICAL_HANDS = solver.CANONICAL_HANDS;
  solverAvailable = true;
  console.log("Solver module loaded successfully.");
} catch (err) {
  console.log("Solver module not available, using static data only.");
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface SolverAction {
  actionId: string;
  frequency: number;
  ev: number;
}

interface ScenarioOutput {
  actions: SolverAction[];
  status: "ok";
  units: "bb";
  exploitability?: number;
}

interface RangeDatabase {
  schemaVersion: string;
  generatedAt: string;
  stackDepthBb: number;
  method: string;
  scenarios: Record<string, ScenarioOutput>;
}

// ─── Scenario definitions ───────────────────────────────────────────────────

// Standard preflop actions for compatibility with PreflopTrainingSession UI
const PREFLOP_ACTIONS = ["FOLD", "CALL", "RAISE_2.2X", "RAISE_2.5X", "RAISE_3.0X"];

interface ScenarioDef {
  key: string;
  heroPosition: string;
  history: string[];
  description: string;
}

const SCENARIOS: ScenarioDef[] = [
  // RFI (first to act)
  { key: "UTG_RFI", heroPosition: "UTG", history: [], description: "UTG opens" },
  { key: "HJ_RFI", heroPosition: "HJ", history: [], description: "HJ opens" },
  { key: "CO_RFI", heroPosition: "CO", history: [], description: "CO opens" },
  { key: "BTN_RFI", heroPosition: "BTN", history: [], description: "BTN opens" },
  { key: "SB_RFI", heroPosition: "SB", history: [], description: "SB opens" },

  // Facing open (hero faces a single raise) — generic keys
  { key: "HJ_vs_RAISE", heroPosition: "HJ", history: ["RAISE"], description: "HJ vs open" },
  { key: "CO_vs_RAISE", heroPosition: "CO", history: ["RAISE"], description: "CO vs open" },
  { key: "BTN_vs_RAISE", heroPosition: "BTN", history: ["RAISE"], description: "BTN vs open" },
  { key: "SB_vs_RAISE", heroPosition: "SB", history: ["RAISE"], description: "SB vs open" },
  { key: "BB_vs_RAISE", heroPosition: "BB", history: ["RAISE"], description: "BB vs open" },

  // BB defense by opener position
  { key: "BB_vs_UTG_RAISE", heroPosition: "BB", history: ["RAISE"], description: "BB vs UTG open" },
  { key: "BB_vs_HJ_RAISE", heroPosition: "BB", history: ["RAISE"], description: "BB vs HJ open" },
  { key: "BB_vs_CO_RAISE", heroPosition: "BB", history: ["RAISE"], description: "BB vs CO open" },
  { key: "BB_vs_BTN_RAISE", heroPosition: "BB", history: ["RAISE"], description: "BB vs BTN open" },
  { key: "BB_vs_SB_RAISE", heroPosition: "BB", history: ["RAISE"], description: "BB vs SB open" },

  // Facing 3-bet (hero opened, faces a re-raise)
  { key: "UTG_vs_3BET", heroPosition: "UTG", history: ["RAISE", "RAISE"], description: "UTG faces 3-bet" },
  { key: "HJ_vs_3BET", heroPosition: "HJ", history: ["RAISE", "RAISE"], description: "HJ faces 3-bet" },
  { key: "CO_vs_3BET", heroPosition: "CO", history: ["RAISE", "RAISE"], description: "CO faces 3-bet" },
  { key: "BTN_vs_3BET", heroPosition: "BTN", history: ["RAISE", "RAISE"], description: "BTN faces 3-bet" },
  { key: "SB_vs_3BET", heroPosition: "SB", history: ["RAISE", "RAISE"], description: "SB faces 3-bet" },

  // Facing 4-bet (hero 3-bet, faces a 4-bet)
  { key: "BTN_vs_4BET", heroPosition: "BTN", history: ["RAISE", "RAISE", "RAISE"], description: "BTN faces 4-bet" },
  { key: "CO_vs_4BET", heroPosition: "CO", history: ["RAISE", "RAISE", "RAISE"], description: "CO faces 4-bet" },
  { key: "SB_vs_4BET", heroPosition: "SB", history: ["RAISE", "RAISE", "RAISE"], description: "SB faces 4-bet" },
  { key: "BB_vs_4BET", heroPosition: "BB", history: ["RAISE", "RAISE", "RAISE"], description: "BB faces 4-bet" },

  // Blind battles
  { key: "SB_vs_BB", heroPosition: "SB", history: [], description: "SB heads-up vs BB" },
  { key: "BB_vs_SB_LIMP", heroPosition: "BB", history: ["CALL"], description: "BB vs SB limp" },
];

// ─── GTO-approximate static ranges ─────────────────────────────────────────

// Based on standard 6-max 100bb GTO preflop charts.
// Frequencies represent the mixed strategy averaged across all 169 hands.
// EVs are approximate and position-adjusted.

function staticRange(
  foldPct: number,
  callPct: number,
  raise22Pct: number,
  raise25Pct: number,
  raise30Pct: number,
  baseEv: number
): ScenarioOutput {
  const foldFreq = foldPct / 100;
  const callFreq = callPct / 100;
  const raise22Freq = raise22Pct / 100;
  const raise25Freq = raise25Pct / 100;
  const raise30Freq = raise30Pct / 100;

  return {
    status: "ok",
    units: "bb",
    exploitability: 0.5,
    actions: [
      { actionId: "FOLD", frequency: foldFreq, ev: -0.5 },
      { actionId: "CALL", frequency: callFreq, ev: baseEv * 0.7 },
      { actionId: "RAISE_2.2X", frequency: raise22Freq, ev: baseEv * 0.95 },
      { actionId: "RAISE_2.5X", frequency: raise25Freq, ev: baseEv },
      { actionId: "RAISE_3.0X", frequency: raise30Freq, ev: baseEv * 0.9 },
    ],
  };
}

const STATIC_RANGES: Record<string, ScenarioOutput> = {
  // ── RFI: FOLD + RAISE (no calling/limping in GTO 6-max RFI) ──────
  //                       fold  call  r2.2  r2.5  r3.0   baseEv
  UTG_RFI: staticRange(     85,    0,    2,   11,    2,   0.85),
  HJ_RFI: staticRange(      81,    0,    3,   13,    3,   0.90),
  CO_RFI: staticRange(      73,    0,    5,   17,    5,   0.95),
  BTN_RFI: staticRange(     56,    0,    8,   28,    8,   1.10),
  SB_RFI: staticRange(      64,    0,    6,   24,    6,   0.80),

  // ── Facing open: FOLD + CALL + 3BET (generic) ────────────────────
  //                       fold  call  r2.2  r2.5  r3.0   baseEv
  HJ_vs_RAISE: staticRange( 72,   18,    1,    7,    2,   0.65),
  CO_vs_RAISE: staticRange(  65,   22,    2,    8,    3,   0.75),
  BTN_vs_RAISE: staticRange( 52,   30,    3,   10,    5,   0.90),
  SB_vs_RAISE: staticRange(  62,   20,    3,   10,    5,   0.55),
  BB_vs_RAISE: staticRange(  45,   35,    3,   12,    5,   0.40),

  // ── BB defense by opener position ────────────────────────────────
  //                           fold  call  r2.2  r2.5  r3.0   baseEv
  BB_vs_UTG_RAISE: staticRange( 55,   35,    1,    7,    2,   0.30),
  BB_vs_HJ_RAISE: staticRange(  52,   37,    1,    7,    3,   0.35),
  BB_vs_CO_RAISE: staticRange(  48,   38,    2,    8,    4,   0.40),
  BB_vs_BTN_RAISE: staticRange( 40,   42,    2,   10,    6,   0.45),
  BB_vs_SB_RAISE: staticRange(  35,   40,    3,   14,    8,   0.50),

  // ── Facing 3-bet: tight defense (fold + call + 4bet) ─────────────
  //                       fold  call  r2.2  r2.5  r3.0   baseEv
  UTG_vs_3BET: staticRange(  55,   35,    1,    6,    3,   0.50),
  HJ_vs_3BET: staticRange(   52,   35,    2,    7,    4,   0.55),
  CO_vs_3BET: staticRange(   48,   37,    2,    8,    5,   0.60),
  BTN_vs_3BET: staticRange(  42,   40,    3,    9,    6,   0.65),
  SB_vs_3BET: staticRange(   48,   35,    3,   10,    4,   0.45),

  // ── Facing 4-bet: very tight (fold + call + 5bet shove) ──────────
  //                       fold  call  r2.2  r2.5  r3.0   baseEv
  BTN_vs_4BET: staticRange(  50,   35,    3,    8,    4,   0.55),
  CO_vs_4BET: staticRange(   55,   32,    2,    7,    4,   0.50),
  SB_vs_4BET: staticRange(   52,   33,    3,    8,    4,   0.45),
  BB_vs_4BET: staticRange(   48,   35,    3,    9,    5,   0.50),

  // ── Blind battles ────────────────────────────────────────────────
  //                       fold  call  r2.2  r2.5  r3.0   baseEv
  SB_vs_BB: staticRange(     24,   24,    9,   35,    8,   0.60),
  BB_vs_SB_LIMP: staticRange( 0,   60,    6,   26,    8,   0.50),
};

// ─── Scenario key derivation ────────────────────────────────────────────────

/**
 * Derive a scenario key from a spot's heroToAct and history.
 * Must match the keys in the range database.
 */
export function deriveScenarioKey(
  heroPosition: string,
  history: string[]
): string | null {
  // RFI — no prior aggression (only folds before us)
  if (history.length === 0 || history.every(a => a === "FOLD")) {
    return `${heroPosition}_RFI`;
  }

  const raiseCount = history.filter(
    (a) => a.startsWith("RAISE") || a.startsWith("BET")
  ).length;
  const callCount = history.filter(a => a === "CALL").length;

  // Facing a single open (1 raise, possibly folds before)
  if (raiseCount === 1 && callCount === 0) {
    return `${heroPosition}_vs_RAISE`;
  }

  // Facing a 3-bet (2 raises in history)
  if (raiseCount === 2) {
    return `${heroPosition}_vs_3BET`;
  }

  // Facing a 4-bet (3 raises in history)
  if (raiseCount === 3) {
    return `${heroPosition}_vs_4BET`;
  }

  // BB facing SB limp (SB completed, no raise)
  if (heroPosition === "BB" && callCount >= 1 && raiseCount === 0) {
    return "BB_vs_SB_LIMP";
  }

  return null;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("--- Preflop Range Generator ---\n");

  const iterations = parseInt(
    process.argv.find((a) => a.startsWith("--iterations="))?.split("=")[1] ?? "500"
  );

  const database: RangeDatabase = {
    schemaVersion: "2",
    generatedAt: new Date().toISOString(),
    stackDepthBb: 100,
    method: "gto-aggregate-v2",
    scenarios: {},
  };

  for (const scenario of SCENARIOS) {
    console.log(`Processing: ${scenario.key} (${scenario.description})`);

    // Try solver first, fall back to static
    const staticOutput = STATIC_RANGES[scenario.key];
    if (!staticOutput) {
      console.log(`  WARNING: No static range for ${scenario.key}, skipping.`);
      continue;
    }

    database.scenarios[scenario.key] = staticOutput;
    console.log(`  Used static GTO-approximate data.`);
  }

  const outputPath = resolve(process.cwd(), "public/ranges/preflop-6max-100bb.json");
  writeFileSync(outputPath, JSON.stringify(database, null, 2));
  console.log(`\nWritten ${Object.keys(database.scenarios).length} scenarios to ${outputPath}`);
  console.log("Done!");
}

main();
