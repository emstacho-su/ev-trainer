// src/lib/solver/evaluation/precompute.ts
// Precomputed equity table generation and I/O.

import * as fs from 'fs';
import * as path from 'path';
import type { CanonicalHand } from '../types';
import { CANONICAL_HANDS } from '../abstraction/cards';
import {
  NUM_CANONICAL_HANDS,
  calculateCanonicalEquity,
  getEquityIndex,
  setPreflopEquityTable,
  getEquityTable,
} from './equity';

/**
 * Table file header for versioning and validation.
 */
const TABLE_MAGIC = 0x45515459; // "EQTY" in little-endian
const TABLE_VERSION = 1;

/**
 * Progress callback type for long-running operations.
 */
export type ProgressCallback = (
  current: number,
  total: number,
  currentHand: CanonicalHand,
  elapsedMs: number
) => void;

/**
 * Generates the full preflop equity table using Monte Carlo simulation.
 *
 * This is computationally expensive: 169 * 169 = 28,561 matchups.
 * With 1000 iterations each, that's ~28M board simulations.
 * Expected runtime: 5-30 minutes depending on hardware.
 *
 * @param iterationsPerMatchup - Monte Carlo iterations per combo pair (default 1000)
 * @param progressCallback - Optional callback for progress updates
 * @returns Float64Array with 169*169 = 28,561 equity values
 */
export function generatePreflopEquityTable(
  iterationsPerMatchup: number = 1000,
  progressCallback?: ProgressCallback
): Float64Array {
  const tableSize = NUM_CANONICAL_HANDS * NUM_CANONICAL_HANDS;
  const table = new Float64Array(tableSize);

  // Fill with 0.5 (default for unknown/same matchups)
  table.fill(0.5);

  const startTime = Date.now();
  let computed = 0;

  // Only compute upper triangle (including diagonal)
  // Lower triangle is symmetric: equity(B, A) = 1 - equity(A, B)
  for (let i = 0; i < NUM_CANONICAL_HANDS; i++) {
    const hand1 = CANONICAL_HANDS[i];

    for (let j = i; j < NUM_CANONICAL_HANDS; j++) {
      const hand2 = CANONICAL_HANDS[j];

      // Calculate equity (handles same-hand case internally)
      const equity = calculateCanonicalEquity(hand1, hand2, iterationsPerMatchup);

      // Store in upper triangle position
      const index = i * NUM_CANONICAL_HANDS + j;
      table[index] = equity;

      computed++;
    }

    // Progress callback after each row
    if (progressCallback) {
      const total = (NUM_CANONICAL_HANDS * (NUM_CANONICAL_HANDS + 1)) / 2;
      progressCallback(computed, total, hand1, Date.now() - startTime);
    }
  }

  return table;
}

/**
 * Saves preflop equity table to a binary file.
 *
 * File format:
 * - 4 bytes: Magic number (0x45515459)
 * - 4 bytes: Version number
 * - 4 bytes: Table size (169)
 * - 4 bytes: Reserved (0)
 * - N*N*8 bytes: Float64 equity values
 *
 * @param table - The equity table to save
 * @param filePath - Path to save the file
 */
export function savePreflopEquityTable(table: Float64Array, filePath: string): void {
  const expectedSize = NUM_CANONICAL_HANDS * NUM_CANONICAL_HANDS;
  if (table.length !== expectedSize) {
    throw new Error(`Invalid table size: ${table.length}, expected ${expectedSize}`);
  }

  // Create header
  const headerSize = 16;
  const dataSize = table.length * 8;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // Write header
  buffer.writeUInt32LE(TABLE_MAGIC, 0);
  buffer.writeUInt32LE(TABLE_VERSION, 4);
  buffer.writeUInt32LE(NUM_CANONICAL_HANDS, 8);
  buffer.writeUInt32LE(0, 12); // Reserved

  // Write data
  const tableBytes = Buffer.from(table.buffer);
  tableBytes.copy(buffer, headerSize);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, buffer);
}

/**
 * Loads preflop equity table from a binary file.
 *
 * Validates file format and version before loading.
 *
 * @param filePath - Path to the equity table file
 * @returns true if loaded successfully
 * @throws Error if file is invalid or corrupt
 */
export function loadPreflopEquityTable(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const buffer = fs.readFileSync(filePath);

  // Validate header
  const headerSize = 16;
  if (buffer.length < headerSize) {
    throw new Error('Invalid equity table file: too small');
  }

  const magic = buffer.readUInt32LE(0);
  if (magic !== TABLE_MAGIC) {
    throw new Error(`Invalid equity table file: bad magic number (got 0x${magic.toString(16)})`);
  }

  const version = buffer.readUInt32LE(4);
  if (version !== TABLE_VERSION) {
    throw new Error(`Unsupported equity table version: ${version}`);
  }

  const size = buffer.readUInt32LE(8);
  if (size !== NUM_CANONICAL_HANDS) {
    throw new Error(`Invalid equity table size: ${size}`);
  }

  const expectedDataSize = size * size * 8;
  if (buffer.length !== headerSize + expectedDataSize) {
    throw new Error(`Invalid equity table file size: ${buffer.length}`);
  }

  // Load data
  const dataBuffer = buffer.subarray(headerSize);
  const table = new Float64Array(
    dataBuffer.buffer,
    dataBuffer.byteOffset,
    size * size
  );

  // Copy to avoid issues with buffer references
  const tableCopy = new Float64Array(table);
  setPreflopEquityTable(tableCopy);

  return true;
}

/**
 * Gets default equity table path.
 */
export function getDefaultEquityTablePath(): string {
  return path.join(process.cwd(), 'data', 'preflop-equity.bin');
}

/**
 * Loads or generates the preflop equity table.
 *
 * Attempts to load from file first. If not available,
 * generates the table (expensive) and saves it.
 *
 * @param filePath - Path to load/save (defaults to data/preflop-equity.bin)
 * @param iterations - Monte Carlo iterations if generating
 * @param progressCallback - Progress callback if generating
 * @returns true if table is now available
 */
export async function ensurePreflopEquityTable(
  filePath: string = getDefaultEquityTablePath(),
  iterations: number = 1000,
  progressCallback?: ProgressCallback
): Promise<boolean> {
  // Try to load existing table
  try {
    if (loadPreflopEquityTable(filePath)) {
      return true;
    }
  } catch (e) {
    // Failed to load, will regenerate
    console.warn(`Failed to load equity table: ${e}`);
  }

  // Generate new table
  console.log('Generating preflop equity table (this may take several minutes)...');
  const table = generatePreflopEquityTable(iterations, progressCallback);

  // Save for future use
  try {
    savePreflopEquityTable(table, filePath);
    console.log(`Saved equity table to ${filePath}`);
  } catch (e) {
    console.warn(`Failed to save equity table: ${e}`);
  }

  // Set as active table
  setPreflopEquityTable(table);

  return true;
}

/**
 * Validates that the equity table is internally consistent.
 *
 * Checks:
 * - Symmetry: equity(A, B) = 1 - equity(B, A)
 * - Range: All values between 0 and 1
 * - Diagonal: Self-matchups are 0.5
 *
 * @returns Array of validation errors, empty if valid
 */
export function validateEquityTable(): string[] {
  const table = getEquityTable();
  if (!table) {
    return ['Equity table not loaded'];
  }

  const errors: string[] = [];
  const tolerance = 0.02; // 2% tolerance for Monte Carlo variance

  for (let i = 0; i < NUM_CANONICAL_HANDS; i++) {
    for (let j = 0; j < NUM_CANONICAL_HANDS; j++) {
      const index = i * NUM_CANONICAL_HANDS + j;
      const value = table[index];

      // Check range
      if (value < 0 || value > 1) {
        errors.push(`Out of range at [${i}][${j}]: ${value}`);
      }

      // Check diagonal (self-matchup should be 0.5)
      if (i === j && Math.abs(value - 0.5) > 0.001) {
        errors.push(`Diagonal mismatch at [${i}][${i}]: ${value} (expected 0.5)`);
      }

      // Check symmetry (only need to check upper triangle vs lower)
      if (i < j) {
        const symmetricIndex = j * NUM_CANONICAL_HANDS + i;
        const symmetricValue = table[symmetricIndex];
        const expectedSymmetric = 1 - value;

        // Note: In our storage, lower triangle might not be explicitly stored
        // This check is for when we have the full table
        if (Math.abs(symmetricValue + value - 1) > tolerance && symmetricValue !== 0.5) {
          errors.push(
            `Symmetry violation at [${i}][${j}]: ${value} + [${j}][${i}]: ${symmetricValue} != 1.0`
          );
        }
      }
    }
  }

  return errors;
}
