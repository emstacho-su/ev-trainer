/**
 * Generates a comprehensive demo pack with 100 preflop and 100 postflop spots.
 * Run with: npx tsx scripts/generateDemoPack.ts
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

interface Spot {
  schemaVersion: "1";
  spotId: string;
  gameType: "NLHE";
  blinds: { sb: number; bb: number; ante: number };
  positions: string[];
  stacksBb: Record<string, number>;
  potBb: number;
  board: string[];
  history: string[];
  heroToAct: string;
}

interface SpotMeta {
  street: string;
  heroPosition: string;
  villainPosition: string;
  effectiveStackBb: number;
  potType: "SRP" | "3BP";
}

interface SpotEntry {
  spot: Spot;
  meta: SpotMeta;
}

const POSITIONS = ["SB", "BB", "UTG", "HJ", "CO", "BTN"] as const;
const STACK_SIZES = [20, 40, 60, 100, 150] as const;

// Board textures for postflop
const FLOP_BOARDS = [
  ["Ah", "Kd", "7c"], ["Ks", "Qh", "2d"], ["Qc", "Jd", "Ts"], // Broadway
  ["9h", "8d", "7c"], ["8s", "7h", "6d"], ["7c", "6d", "5h"], // Connected
  ["Ah", "8d", "3c"], ["Kd", "7h", "2s"], ["Qc", "5d", "2h"], // Dry
  ["Jh", "Th", "4h"], ["9d", "6d", "2d"], ["8c", "5c", "3c"], // Monotone
  ["Kh", "Kd", "7c"], ["9s", "9h", "3d"], ["5c", "5d", "2h"], // Paired
  ["Ah", "Td", "6c"], ["Kc", "9h", "4d"], ["Qd", "8s", "3h"], // Mixed
  ["Jc", "7h", "2d"], ["Ts", "6d", "3c"], ["9h", "5c", "2s"], // Low
  ["As", "Qs", "5s"], ["Kh", "Jh", "8h"], ["Qd", "Td", "7d"], // Flush draw
  ["Ac", "Kh", "Qd"], ["Kd", "Qc", "Js"], ["Qh", "Jd", "Tc"], // Super connected
  ["Ad", "5h", "4c"], ["Kc", "4d", "3h"], ["7s", "6h", "5d"], // Wheel draws
];

// All possible cards for picking unique turn/river cards
const ALL_CARDS = [
  "2c", "2d", "2h", "2s", "3c", "3d", "3h", "3s", "4c", "4d", "4h", "4s",
  "5c", "5d", "5h", "5s", "6c", "6d", "6h", "6s", "7c", "7d", "7h", "7s",
  "8c", "8d", "8h", "8s", "9c", "9d", "9h", "9s", "Tc", "Td", "Th", "Ts",
  "Jc", "Jd", "Jh", "Js", "Qc", "Qd", "Qh", "Qs", "Kc", "Kd", "Kh", "Ks",
  "Ac", "Ad", "Ah", "As",
];

function getUniqueCard(existingCards: string[], index: number): string {
  const available = ALL_CARDS.filter((c) => !existingCards.includes(c));
  return available[index % available.length];
}

function createSpot(
  id: number,
  positions: string[],
  stackBb: number,
  potBb: number,
  board: string[],
  history: string[],
  heroToAct: string
): Spot {
  const stacksBb: Record<string, number> = {};
  positions.forEach((p) => (stacksBb[p] = stackBb));

  return {
    schemaVersion: "1",
    spotId: `spot-${String(id).padStart(3, "0")}`,
    gameType: "NLHE",
    blinds: { sb: 0.5, bb: 1, ante: 0 },
    positions,
    stacksBb,
    potBb,
    board,
    history,
    heroToAct,
  };
}

function getStreet(board: string[]): string {
  if (board.length === 0) return "PREFLOP";
  if (board.length === 3) return "FLOP";
  if (board.length === 4) return "TURN";
  return "RIVER";
}

function getVillain(positions: string[], hero: string): string {
  return positions.find((p) => p !== hero) || positions[0];
}

// Generate preflop spots
function generatePreflopSpots(): SpotEntry[] {
  const spots: SpotEntry[] = [];
  let id = 1;

  // RFI spots (25) - First to act
  const rfiPositions = ["UTG", "HJ", "CO", "BTN", "SB"];
  for (const hero of rfiPositions) {
    for (const stack of STACK_SIZES) {
      const villain = hero === "SB" ? "BB" : "BB";
      const positions = hero === "SB" ? ["SB", "BB"] : [hero, "BB"];
      const spot = createSpot(id++, positions, stack, 1.5, [], [], hero);
      spots.push({
        spot,
        meta: {
          street: "PREFLOP",
          heroPosition: hero,
          villainPosition: villain,
          effectiveStackBb: stack,
          potType: "SRP",
        },
      });
    }
  }

  // FacingOpen spots (25) - Facing a single raise
  const facingOpenScenarios = [
    { hero: "HJ", villain: "UTG" },
    { hero: "CO", villain: "UTG" },
    { hero: "CO", villain: "HJ" },
    { hero: "BTN", villain: "UTG" },
    { hero: "BTN", villain: "CO" },
  ];
  for (const { hero, villain } of facingOpenScenarios) {
    for (const stack of STACK_SIZES) {
      const spot = createSpot(id++, [villain, hero], stack, 3.5, [], ["RAISE"], hero);
      spots.push({
        spot,
        meta: {
          street: "PREFLOP",
          heroPosition: hero,
          villainPosition: villain,
          effectiveStackBb: stack,
          potType: "SRP",
        },
      });
    }
  }

  // 3Bet spots (25) - Facing a 3bet
  const threeBetScenarios = [
    { hero: "UTG", villain: "BTN" },
    { hero: "HJ", villain: "CO" },
    { hero: "CO", villain: "BTN" },
    { hero: "BTN", villain: "BB" },
    { hero: "CO", villain: "SB" },
  ];
  for (const { hero, villain } of threeBetScenarios) {
    for (const stack of STACK_SIZES) {
      const spot = createSpot(id++, [hero, villain], stack, 10, [], ["RAISE", "RAISE"], hero);
      spots.push({
        spot,
        meta: {
          street: "PREFLOP",
          heroPosition: hero,
          villainPosition: villain,
          effectiveStackBb: stack,
          potType: "3BP",
        },
      });
    }
  }

  // BlindDefense spots (25) - Blinds facing action
  const blindDefenseScenarios = [
    { hero: "BB", villain: "BTN" },
    { hero: "BB", villain: "CO" },
    { hero: "BB", villain: "SB" },
    { hero: "SB", villain: "BTN" },
    { hero: "SB", villain: "CO" },
  ];
  for (const { hero, villain } of blindDefenseScenarios) {
    for (const stack of STACK_SIZES) {
      const spot = createSpot(id++, [villain, hero], stack, 3.5, [], ["RAISE"], hero);
      spots.push({
        spot,
        meta: {
          street: "PREFLOP",
          heroPosition: hero,
          villainPosition: villain,
          effectiveStackBb: stack,
          potType: "SRP",
        },
      });
    }
  }

  return spots;
}

// Generate postflop spots
function generatePostflopSpots(startId: number): SpotEntry[] {
  const spots: SpotEntry[] = [];
  let id = startId;

  // Flop spots (40)
  const flopScenarios = [
    { hero: "BTN", villain: "BB", potType: "SRP" as const, history: ["CHECK"] },
    { hero: "BB", villain: "BTN", potType: "SRP" as const, history: ["CHECK"] },
    { hero: "CO", villain: "BB", potType: "SRP" as const, history: ["CHECK"] },
    { hero: "BB", villain: "CO", potType: "SRP" as const, history: ["CHECK"] },
    { hero: "BTN", villain: "BB", potType: "3BP" as const, history: ["CHECK"] },
    { hero: "BB", villain: "BTN", potType: "3BP" as const, history: ["CHECK"] },
    { hero: "SB", villain: "BTN", potType: "SRP" as const, history: ["CHECK"] },
    { hero: "BTN", villain: "SB", potType: "SRP" as const, history: ["CHECK"] },
  ];

  for (let i = 0; i < 40; i++) {
    const scenario = flopScenarios[i % flopScenarios.length];
    const board = FLOP_BOARDS[i % FLOP_BOARDS.length];
    const stack = STACK_SIZES[i % STACK_SIZES.length];
    const potBb = scenario.potType === "SRP" ? 6 : 12;

    const spot = createSpot(
      id++,
      [scenario.villain, scenario.hero],
      stack,
      potBb,
      board,
      scenario.history,
      scenario.hero
    );
    spots.push({
      spot,
      meta: {
        street: "FLOP",
        heroPosition: scenario.hero,
        villainPosition: scenario.villain,
        effectiveStackBb: stack,
        potType: scenario.potType,
      },
    });
  }

  // Turn spots (30)
  const turnScenarios = [
    { hero: "BTN", villain: "BB", potType: "SRP" as const, history: ["CHECK", "BET", "CALL", "CHECK"] },
    { hero: "BB", villain: "BTN", potType: "SRP" as const, history: ["CHECK", "CHECK", "CHECK"] },
    { hero: "CO", villain: "BB", potType: "3BP" as const, history: ["CHECK", "BET", "CALL", "CHECK"] },
    { hero: "BB", villain: "CO", potType: "3BP" as const, history: ["CHECK", "CHECK", "CHECK"] },
    { hero: "BTN", villain: "SB", potType: "SRP" as const, history: ["CHECK", "CHECK", "CHECK"] },
    { hero: "SB", villain: "BTN", potType: "SRP" as const, history: ["CHECK", "BET", "CALL", "CHECK"] },
  ];

  for (let i = 0; i < 30; i++) {
    const scenario = turnScenarios[i % turnScenarios.length];
    const flopBoard = FLOP_BOARDS[i % FLOP_BOARDS.length];
    const turnCard = getUniqueCard(flopBoard, i);
    const board = [...flopBoard, turnCard];
    const stack = STACK_SIZES[i % STACK_SIZES.length];
    const potBb = scenario.potType === "SRP" ? 9 : 18;

    const spot = createSpot(
      id++,
      [scenario.villain, scenario.hero],
      stack,
      potBb,
      board,
      scenario.history,
      scenario.hero
    );
    spots.push({
      spot,
      meta: {
        street: "TURN",
        heroPosition: scenario.hero,
        villainPosition: scenario.villain,
        effectiveStackBb: stack,
        potType: scenario.potType,
      },
    });
  }

  // River spots (30)
  const riverScenarios = [
    { hero: "BTN", villain: "BB", potType: "SRP" as const, history: ["CHECK", "BET", "CALL", "CHECK", "CHECK", "CHECK"] },
    { hero: "BB", villain: "BTN", potType: "SRP" as const, history: ["CHECK", "CHECK", "CHECK", "CHECK", "CHECK"] },
    { hero: "CO", villain: "BB", potType: "3BP" as const, history: ["CHECK", "BET", "CALL", "CHECK", "BET", "CALL", "CHECK"] },
    { hero: "BB", villain: "CO", potType: "3BP" as const, history: ["CHECK", "CHECK", "CHECK", "CHECK", "CHECK"] },
    { hero: "BTN", villain: "SB", potType: "SRP" as const, history: ["CHECK", "CHECK", "CHECK", "CHECK", "CHECK"] },
    { hero: "SB", villain: "BTN", potType: "SRP" as const, history: ["CHECK", "BET", "CALL", "CHECK", "CHECK", "CHECK"] },
  ];

  for (let i = 0; i < 30; i++) {
    const scenario = riverScenarios[i % riverScenarios.length];
    const flopBoard = FLOP_BOARDS[i % FLOP_BOARDS.length];
    const turnCard = getUniqueCard(flopBoard, i);
    const riverCard = getUniqueCard([...flopBoard, turnCard], i + 10);
    const board = [...flopBoard, turnCard, riverCard];
    const stack = STACK_SIZES[i % STACK_SIZES.length];
    const potBb = scenario.potType === "SRP" ? 12 : 24;

    const spot = createSpot(
      id++,
      [scenario.villain, scenario.hero],
      stack,
      potBb,
      board,
      scenario.history,
      scenario.hero
    );
    spots.push({
      spot,
      meta: {
        street: "RIVER",
        heroPosition: scenario.hero,
        villainPosition: scenario.villain,
        effectiveStackBb: stack,
        potType: scenario.potType,
      },
    });
  }

  return spots;
}

function main() {
  const preflopSpots = generatePreflopSpots();
  const postflopSpots = generatePostflopSpots(101);

  const pack = {
    schemaVersion: "1",
    packId: "ev-demo-pack-v2",
    name: "EV Demo Pack v2",
    description: "Comprehensive demo pack with 100 preflop and 100 postflop spots.",
    author: "EV Trainer",
    version: "2.0.0",
    createdAt: new Date().toISOString(),
    spots: [...preflopSpots, ...postflopSpots],
  };

  const outPath = resolve(process.cwd(), "public/packs/ev-demo-pack-v2.json");
  writeFileSync(outPath, JSON.stringify(pack, null, 2));

  console.log(`Generated ${pack.spots.length} spots`);
  console.log(`  Preflop: ${preflopSpots.length}`);
  console.log(`  Postflop: ${postflopSpots.length}`);
  console.log(`Written to: ${outPath}`);
}

main();
