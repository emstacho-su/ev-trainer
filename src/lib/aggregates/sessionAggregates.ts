import { isBestActionFromEvLoss, readEvLossVsBest, type ReviewEntryGradeLike } from "../v2/reviewEntry";

export interface SessionAggregates {
  volume: number;
  meanEvLoss: number;
  bestActionRate: number;
}

export function computeSessionAggregates(
  entries: ReviewEntryGradeLike[]
): SessionAggregates {
  const volume = entries.length;
  if (volume === 0) {
    return { volume: 0, meanEvLoss: 0, bestActionRate: 0 };
  }

  let evLossTotal = 0;
  let bestActionCount = 0;

  for (const entry of entries) {
    const evLoss = readEvLossVsBest(entry);
    evLossTotal += evLoss;
    if (isBestActionFromEvLoss(evLoss)) {
      bestActionCount += 1;
    }
  }

  return {
    volume,
    meanEvLoss: evLossTotal / volume,
    bestActionRate: bestActionCount / volume,
  };
}
