// src/lib/solver/evaluation/index.ts
// Public exports for equity evaluation module.

export {
  NUM_CANONICAL_HANDS,
  calculatePreflopEquityMonteCarlo,
  calculatePreflopEquityFromTable,
  calculateCanonicalEquity,
  getEquityIndex,
  setPreflopEquityTable,
  isEquityTableLoaded,
  clearEquityTable,
  getEquityTable,
} from './equity';

export {
  generatePreflopEquityTable,
  savePreflopEquityTable,
  loadPreflopEquityTable,
  getDefaultEquityTablePath,
  ensurePreflopEquityTable,
  validateEquityTable,
  type ProgressCallback,
} from './precompute';
