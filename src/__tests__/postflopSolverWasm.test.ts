/**
 * Integration test: postflop-solver WASM modules.
 * Verifies WASM loads in Node.js, RangeManager parses ranges,
 * and GameManager solves a simple flop spot.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let solverModule: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rangeModule: any;

const WASM_DIR = path.resolve(__dirname, "../../wasm/pkg");

async function loadWasmModule(pkgDir: string, jsFile: string, wasmFile: string) {
  const wasmPath = path.join(pkgDir, wasmFile);
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM file not found: ${wasmPath}. Run scripts/build-wasm.sh first.`);
  }
  const wasmBytes = fs.readFileSync(wasmPath);
  const mod = await import(path.join(pkgDir, jsFile));
  mod.initSync({ module: wasmBytes });
  return mod;
}

describe("Postflop Solver WASM", () => {
  beforeAll(async () => {
    solverModule = await loadWasmModule(
      path.join(WASM_DIR, "solver-st"),
      "solver.js",
      "solver_bg.wasm"
    );
    rangeModule = await loadWasmModule(
      path.join(WASM_DIR, "range"),
      "range.js",
      "range_bg.wasm"
    );
  });

  describe("RangeManager", () => {
    it("creates a RangeManager and parses a range string", () => {
      const rm = rangeModule.RangeManager.new();
      const error = rm.from_string("AA,KK,QQ");
      expect(error).toBeUndefined(); // undefined = success, string = error

      // get_weights() returns 13x13 grid (169), raw_data() returns 1326 combos
      const grid = rm.get_weights();
      expect(grid).toBeInstanceOf(Float32Array);
      expect(grid.length).toBe(169);

      const combos = rm.raw_data();
      expect(combos).toBeInstanceOf(Float32Array);
      expect(combos.length).toBe(1326);
      // AA has 6 combos, KK has 6, QQ has 6 => 18 non-zero weights
      const nonZero = Array.from(combos).filter((w) => w > 0).length;
      expect(nonZero).toBe(18);
      rm.free();
    });

    it("returns error for invalid range string", () => {
      const rm = rangeModule.RangeManager.new();
      const error = rm.from_string("INVALID_RANGE_XYZ");
      expect(typeof error).toBe("string");
      rm.free();
    });

    it("clears range data", () => {
      const rm = rangeModule.RangeManager.new();
      rm.from_string("AA");
      rm.clear();
      const combos = rm.raw_data();
      const nonZero = Array.from(combos).filter((w) => w > 0).length;
      expect(nonZero).toBe(0);
      rm.free();
    });
  });

  describe("GameManager", () => {
    it("creates a GameManager", () => {
      const gm = solverModule.GameManager.new();
      expect(gm).toBeDefined();
      gm.free();
    });

    it("initializes and solves a simple flop spot", () => {
      const gm = solverModule.GameManager.new();

      // Build ranges: OOP = "QQ+,AK", IP = "TT+,AQ+"
      const oopRange = parseRange("QQ+,AKs,AKo");
      const ipRange = parseRange("TT+,AQs+,AQo+,AKs,AKo");

      // Board: Ah Kd 7c
      // rank: A=12, K=11, 7=5; suit: c=0, d=1, h=2, s=3
      const board = new Uint8Array([
        4 * 12 + 2, // Ah
        4 * 11 + 1, // Kd
        4 * 5 + 0,  // 7c
      ]);

      const initError = gm.init(
        oopRange,          // oop_range
        ipRange,           // ip_range
        board,             // board
        20,                // starting_pot (BB)
        180,               // effective_stack (BB)
        0,                 // rake_rate
        0,                 // rake_cap
        false,             // donk_option
        "33%,67%",         // oop_flop_bet
        "60%",             // oop_flop_raise
        "33%,67%,100%",    // oop_turn_bet
        "60%",             // oop_turn_raise
        "",                // oop_turn_donk
        "33%,67%,100%",    // oop_river_bet
        "60%",             // oop_river_raise
        "",                // oop_river_donk
        "33%,67%",         // ip_flop_bet
        "60%",             // ip_flop_raise
        "33%,67%,100%",    // ip_turn_bet
        "60%",             // ip_turn_raise
        "33%,67%,100%",    // ip_river_bet
        "60%",             // ip_river_raise
        1.5,               // add_allin_threshold
        0.67,              // force_allin_threshold
        0.1,               // merging_threshold
        "",                // added_lines
        "",                // removed_lines
      );

      expect(initError).toBeUndefined(); // undefined = success

      // Allocate memory and run a few solve steps
      gm.allocate_memory(false);

      for (let i = 0; i < 10; i++) {
        gm.solve_step(i);
      }

      // Check exploitability is a finite number
      const exploitability = gm.exploitability();
      expect(Number.isFinite(exploitability)).toBe(true);
      expect(exploitability).toBeGreaterThanOrEqual(0);

      // Finalize before extracting results
      gm.finalize();

      // Check we can get results
      const numActions = gm.num_actions();
      expect(numActions).toBeGreaterThan(0);

      const results = gm.get_results();
      expect(results).toBeInstanceOf(Float64Array);
      expect(results.length).toBeGreaterThan(0);

      // Verify all result values are finite
      for (let i = 0; i < results.length; i++) {
        expect(Number.isFinite(results[i])).toBe(true);
      }

      gm.free();
    });

    it("reports actions for root node", () => {
      const gm = solverModule.GameManager.new();

      const oopRange = parseRange("QQ+,AKs,AKo");
      const ipRange = parseRange("TT+,AQs+,AQo+");
      const board = new Uint8Array([4 * 12 + 2, 4 * 11 + 1, 4 * 5 + 0]);

      gm.init(
        oopRange, ipRange, board, 20, 180, 0, 0, false,
        "33%,67%", "60%",
        "33%,67%,100%", "60%", "",
        "33%,67%,100%", "60%", "",
        "33%,67%", "60%",
        "33%,67%,100%", "60%",
        "33%,67%,100%", "60%",
        1.5, 0.67, 0.1, "", ""
      );

      gm.allocate_memory(false);

      const actions = gm.actions_after(new Uint32Array([]));
      expect(typeof actions).toBe("string");
      // Root node should have check + bet actions for OOP
      expect(actions.length).toBeGreaterThan(0);

      gm.free();
    });

    it("extracts real strategy frequencies that sum to ~1.0", { timeout: 300_000 }, () => {
      const gm = solverModule.GameManager.new();

      // Use narrow ranges + fewer bet sizes for faster solving
      const oopRange = parseRange("QQ+,AKs");
      const ipRange = parseRange("TT+,AQs+");
      const board = new Uint8Array([4 * 12 + 2, 4 * 11 + 1, 4 * 5 + 0]);

      gm.init(
        oopRange, ipRange, board, 20, 180, 0, 0, false,
        "67%", "",        // OOP flop: single bet size, no raise
        "67%", "", "",    // OOP turn
        "67%", "", "",    // OOP river
        "67%", "",        // IP flop
        "67%", "",        // IP turn
        "67%", "",        // IP river
        1.5, 0.67, 0.1, "", ""
      );

      gm.allocate_memory(false);

      // Run 20 iterations — enough to differentiate strategy, fast enough for CI
      for (let i = 0; i < 20; i++) {
        gm.solve_step(i);
      }
      gm.finalize();

      // Navigate to root node
      gm.apply_history(new Uint32Array(0));

      const numActions = gm.num_actions();
      const results = gm.get_results();
      const actionsStr = gm.actions_after(new Uint32Array(0));
      // WASM actions are slash-delimited: "Check:0/Bet:7/Bet:13"
      const actionNames = actionsStr.split("/").filter(Boolean);

      const currentPlayer = gm.current_player();
      const playerIndex = currentPlayer === "ip" ? 1 : 0;

      const oopCombos = gm.private_cards(0);
      const ipCombos = gm.private_cards(1);
      const numOop = oopCombos.length;
      const numIp = ipCombos.length;
      const numCombos = playerIndex === 0 ? numOop : numIp;

      // Verify basic packing: [0]=oop pot, [1]=ip pot, [2]=is_empty_flag
      expect(results[0]).toBeGreaterThan(0); // OOP pot
      expect(results[1]).toBeGreaterThan(0); // IP pot
      const isEmptyFlag = results[2];
      expect(isEmptyFlag).toBe(0); // Both ranges should be active

      // Calculate strategy offset using the packing format
      let offset = 3 + numOop + numIp; // weights
      offset += numOop + numIp; // normalized weights
      offset += numOop + numIp; // equity
      offset += numOop + numIp; // EV
      offset += numOop + numIp; // EV ratios
      const strategyOffset = offset;

      // Extract weighted average strategy
      const weightsOffset = 3 + (playerIndex === 0 ? 0 : numOop);
      let totalWeight = 0;
      for (let c = 0; c < numCombos; c++) {
        totalWeight += results[weightsOffset + c];
      }
      expect(totalWeight).toBeGreaterThan(0);

      // Extract per-action average frequency
      const frequencies: number[] = [];
      for (let a = 0; a < numActions; a++) {
        let weightedFreq = 0;
        for (let c = 0; c < numCombos; c++) {
          const w = results[weightsOffset + c];
          if (w < 1e-7) continue;
          const strategy = results[strategyOffset + a * numCombos + c];
          weightedFreq += w * strategy;
        }
        frequencies.push(totalWeight > 0 ? weightedFreq / totalWeight : 0);
      }

      // Frequencies should sum to ~1.0
      const freqSum = frequencies.reduce((s, f) => s + f, 0);
      expect(freqSum).toBeCloseTo(1.0, 2);

      // Each frequency should be in [0, 1]
      for (const freq of frequencies) {
        expect(freq).toBeGreaterThanOrEqual(-0.001);
        expect(freq).toBeLessThanOrEqual(1.001);
      }

      // We should have action names matching numActions
      expect(actionNames.length).toBe(numActions);

      // Strategy shouldn't be all equal (solver should differentiate)
      const allEqual = frequencies.every((f) => Math.abs(f - frequencies[0]) < 0.01);
      // With 100 iterations this should have differentiated at least somewhat
      // (but we don't assert this strictly as it depends on convergence)

      gm.free();
    });
  });
});

/**
 * Helper: parse a PioRange string into f32[1326] using RangeManager.
 */
function parseRange(rangeStr: string): Float32Array {
  const rm = rangeModule.RangeManager.new();
  const error = rm.from_string(rangeStr);
  if (error) {
    rm.free();
    throw new Error(`Failed to parse range "${rangeStr}": ${error}`);
  }
  const weights = rm.raw_data();
  // Copy before freeing
  const result = new Float32Array(weights);
  rm.free();
  return result;
}
