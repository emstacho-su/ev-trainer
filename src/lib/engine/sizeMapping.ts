// src/lib/engine/sizeMapping.ts

const EPS = 1e-12;

/**
 * Map an arbitrary size (in bb) to the nearest allowed size (in bb).
 * Tie-break rule: if equal distance, choose the smaller size.
 */
export function mapToNearestAllowedSizeBb(
  inputSizeBb: number,
  allowedSizesBb: readonly number[]
): number {
  if (typeof inputSizeBb !== "number" || !Number.isFinite(inputSizeBb) || inputSizeBb <= 0) {
    throw new Error("inputSizeBb must be a finite number > 0");
  }
  if (!Array.isArray(allowedSizesBb) || allowedSizesBb.length === 0) {
    throw new Error("allowedSizesBb must be a non-empty array");
  }

  let bestSize: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < allowedSizesBb.length; i++) {
    const s = allowedSizesBb[i];
    if (typeof s !== "number" || !Number.isFinite(s) || s <= 0) {
      throw new Error(`allowedSizesBb[${i}] must be a finite number > 0`);
    }

    const dist = Math.abs(s - inputSizeBb);

    if (dist < bestDist - EPS) {
      bestDist = dist;
      bestSize = s;
      continue;
    }

    if (Math.abs(dist - bestDist) <= EPS) {
      // tie-break: choose smaller
      if (bestSize === null || s < bestSize) bestSize = s;
    }
  }

  return bestSize as number;
}
