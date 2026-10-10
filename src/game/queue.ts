/**
 * Comparison pools and challenger selection.
 *
 * A Pool holds the facts of ONE comparison group, sorted by value, with
 * percentile ranks and display keys precomputed. The queue picks the next
 * challenger for a reference fact:
 *   - never the reference itself, never an equal value, never a value that
 *     would display identically (no ambiguous Higher/Lower questions);
 *   - unused facts first, so items do not repeat until the pool is spent;
 *   - inside the difficulty band when possible, widening gracefully;
 *   - in a bounded number of steps (no infinite loops, even for tiny pools).
 */
import { displayKey } from '../data/format';
import type { Fact, MetricDefinition } from '../data/schema';
import { DIFFICULTY_BANDS, bandRanges, percentileRanks, type Band } from './difficulty';
import { randomInt, type Rng } from './rng';
import type { Difficulty } from './types';

export type Pool = {
  comparisonGroupId: string;
  facts: readonly Fact[];
  percentiles: Float64Array;
  displayKeys: readonly string[];
};

/** Build a pool, dropping anything that must never reach gameplay. */
export function buildPool(facts: readonly Fact[], metric: MetricDefinition): Pool {
  const groups = new Set(facts.map((f) => f.comparisonGroupId));
  if (groups.size > 1) throw new Error('A pool must contain exactly one comparison group');
  const valid = facts
    .filter((f) => typeof f.value === 'number' && Number.isFinite(f.value) && f.metricId === metric.id && f.unit === metric.unit)
    .slice()
    .sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    comparisonGroupId: valid[0]?.comparisonGroupId ?? '',
    facts: valid,
    percentiles: percentileRanks(valid.map((f) => f.value)),
    displayKeys: valid.map((f) => displayKey(f.value, metric)),
  };
}

/** True when two pool entries make a fair, unambiguous question. */
export function isValidPair(pool: Pool, a: number, b: number): boolean {
  if (a === b) return false;
  const fa = pool.facts[a]!;
  const fb = pool.facts[b]!;
  if (fa.entityId === fb.entityId) return false;
  if (fa.value === fb.value) return false;
  return pool.displayKeys[a] !== pool.displayKeys[b];
}

const WIDENING: Band[] = [
  { min: 0, max: 1 }, // anything valid, as a last resort
];

export class ChallengerQueue {
  private readonly used = new Set<number>();
  private recycled = 0;

  constructor(
    readonly pool: Pool,
    private readonly rng: Rng,
  ) {}

  get usedCount(): number {
    return this.used.size;
  }

  /** How many times the pool has been exhausted and recycled. */
  get recycleCount(): number {
    return this.recycled;
  }

  /** Mark an index as used (e.g. the opening reference). */
  markUsed(index: number): void {
    this.used.add(index);
  }

  /**
   * Choose a starting reference. Normal/hard games start away from the
   * extremes so both answers are plausible on the first question.
   */
  pickStart(difficulty: Difficulty): number | null {
    const n = this.pool.facts.length;
    if (n < 2) return null;
    const p = this.pool.percentiles;
    const [lo, hi] = difficulty === 'easy' ? [0, 1] : [0.15, 0.85];
    const candidates: number[] = [];
    for (let i = 0; i < n; i++) if (p[i]! >= lo && p[i]! <= hi) candidates.push(i);
    const list = candidates.length > 0 ? candidates : [...Array(n).keys()];
    // Prefer starts that have at least one valid partner.
    for (let attempt = 0; attempt < 16; attempt++) {
      const i = list[randomInt(this.rng, list.length)]!;
      if (this.hasAnyPartner(i)) {
        this.used.add(i);
        return i;
      }
    }
    for (const i of list) {
      if (this.hasAnyPartner(i)) {
        this.used.add(i);
        return i;
      }
    }
    return null;
  }

  private hasAnyPartner(ref: number): boolean {
    for (let j = 0; j < this.pool.facts.length; j++) if (isValidPair(this.pool, ref, j)) return true;
    return false;
  }

  /**
   * Pick the next challenger for `ref`. Returns null only if the pool has no
   * valid partner for `ref` at all (e.g. every other value is equal).
   */
  next(ref: number, difficulty: Difficulty): number | null {
    const bands = [DIFFICULTY_BANDS[difficulty], ...WIDENING];
    for (const band of bands) {
      const found = this.pickInBand(ref, band, false);
      if (found !== null) return this.take(found);
    }
    // Every valid partner has been used: recycle the pool (keep the
    // reference marked) and try again, once.
    if (this.used.size > 1) {
      this.used.clear();
      this.used.add(ref);
      this.recycled++;
      for (const band of bands) {
        const found = this.pickInBand(ref, band, false);
        if (found !== null) return this.take(found);
      }
    }
    // Last resort: allow reuse (only reachable for pools with ≤ 2 usable items).
    const any = this.pickInBand(ref, { min: 0, max: 1 }, true);
    return any === null ? null : this.take(any);
  }

  private take(i: number): number {
    this.used.add(i);
    return i;
  }

  private pickInBand(ref: number, band: Band, allowUsed: boolean): number | null {
    const p = this.pool.percentiles[ref]!;
    const ranges = bandRanges(this.pool.percentiles, p, band);
    if (ranges.length === 0) return null;
    const ok = (j: number) => (allowUsed || !this.used.has(j)) && isValidPair(this.pool, ref, j);

    // Choose a side at random when both exist, so the answer is not
    // predictable from which side has more room.
    const order = ranges.length === 2 && this.rng() < 0.5 ? [ranges[1]!, ranges[0]!] : ranges;
    for (const [start, end] of order) {
      const size = end - start;
      // Random probes first: O(1) for large pools.
      for (let attempt = 0; attempt < 24; attempt++) {
        const j = start + randomInt(this.rng, size);
        if (ok(j)) return j;
      }
      // Then a bounded scan from a random offset, so small or crowded
      // ranges are still fully covered without bias toward one end.
      const offset = randomInt(this.rng, size);
      for (let k = 0; k < size; k++) {
        const j = start + ((offset + k) % size);
        if (ok(j)) return j;
      }
    }
    return null;
  }
}
