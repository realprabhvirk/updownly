/**
 * Difficulty is defined on percentile ranks inside one comparison pool, so
 * it behaves the same for populations, temperatures (with negatives) and
 * values that span ten orders of magnitude. Ratios are deliberately avoided.
 *
 *   easy   — the challenger is far away in rank (large percentile gap)
 *   normal — a broad, balanced band
 *   hard   — the challenger is a close neighbour in rank
 */
import type { Difficulty } from './types';

export type Band = { min: number; max: number };

export const DIFFICULTY_BANDS: Record<Difficulty, Band> = {
  easy: { min: 0.3, max: 1 },
  normal: { min: 0.06, max: 0.6 },
  hard: { min: 0.005, max: 0.12 },
};

/**
 * Percentile rank in [0, 1] for each value of an ascending-sorted array.
 * Tied values share their average rank, so ties never fake a distance.
 */
export function percentileRanks(sortedValues: readonly number[]): Float64Array {
  const n = sortedValues.length;
  const out = new Float64Array(n);
  if (n === 1) return out;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sortedValues[j + 1] === sortedValues[i]) j++;
    const rank = (i + j) / 2 / (n - 1);
    for (let k = i; k <= j; k++) out[k] = rank;
    i = j + 1;
  }
  return out;
}

/** First index whose percentile is >= p (percentiles must be ascending). */
export function lowerBound(percentiles: Float64Array, p: number): number {
  let lo = 0;
  let hi = percentiles.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (percentiles[mid]! < p) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose percentile is > p. */
export function upperBound(percentiles: Float64Array, p: number): number {
  let lo = 0;
  let hi = percentiles.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (percentiles[mid]! <= p) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Index ranges [start, end) whose percentile distance from `p` lies within
 * the band: one range below the reference and one above.
 */
export function bandRanges(percentiles: Float64Array, p: number, band: Band): Array<[number, number]> {
  const below: [number, number] = [lowerBound(percentiles, p - band.max), upperBound(percentiles, p - band.min)];
  const above: [number, number] = [lowerBound(percentiles, p + band.min), upperBound(percentiles, p + band.max)];
  return [below, above].filter(([s, e]) => e > s);
}
