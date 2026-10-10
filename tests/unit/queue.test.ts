import { describe, expect, it } from 'vitest';
import { percentileRanks } from '../../src/game/difficulty';
import { ChallengerQueue, buildPool, isValidPair } from '../../src/game/queue';
import { createRng } from '../../src/game/rng';
import { TEST_METRIC, makeFacts, makePool } from './helpers';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('buildPool', () => {
  it('sorts by value and excludes invalid facts', () => {
    const facts = makeFacts([5, Number.NaN, 1, Number.POSITIVE_INFINITY, 3]);
    const pool = buildPool(facts, TEST_METRIC);
    expect(pool.facts.map((f) => f.value)).toEqual([1, 3, 5]);
  });

  it('never mixes comparison groups', () => {
    const facts = [...makeFacts([1, 2]), ...makeFacts([3], { group: 'population|countries|2023' })];
    expect(() => buildPool(facts, TEST_METRIC)).toThrow(/one comparison group/);
  });

  it('drops facts with a different metric or unit', () => {
    const facts = [...makeFacts([1, 2, 3]), ...makeFacts([4], { metricId: 'gdp' }), ...makeFacts([5], { unit: 'ft' })];
    expect(buildPool(facts, TEST_METRIC).facts.length).toBe(3);
  });
});

describe('isValidPair', () => {
  it('rejects self, equal values and visually identical values', () => {
    const pool = makePool([1, 2, 2, 2.0001, 10]);
    expect(isValidPair(pool, 0, 0)).toBe(false);
    expect(isValidPair(pool, 1, 2)).toBe(false); // equal
    expect(isValidPair(pool, 1, 3)).toBe(false); // 2 vs 2.0001 both show "2 m"
    expect(isValidPair(pool, 0, 4)).toBe(true);
  });
});

describe('ChallengerQueue', () => {
  it('never returns the reference or an equal value', () => {
    const pool = makePool([1, 1, 1, 2, 2, 3, 3, 3, 4, 5]);
    const q = new ChallengerQueue(pool, createRng(1));
    let ref = q.pickStart('normal')!;
    for (let i = 0; i < 200; i++) {
      const c = q.next(ref, 'normal');
      expect(c).not.toBeNull();
      expect(c).not.toBe(ref);
      expect(pool.facts[c!]!.value).not.toBe(pool.facts[ref]!.value);
      ref = c!;
    }
  });

  it('does not repeat items until the pool is exhausted', () => {
    const pool = makePool(range(60));
    const q = new ChallengerQueue(pool, createRng(9));
    let ref = q.pickStart('normal')!;
    const seen = new Set([ref]);
    for (let i = 0; i < 59; i++) {
      const c = q.next(ref, 'normal')!;
      expect(seen.has(c)).toBe(false);
      seen.add(c);
      ref = c;
    }
    expect(seen.size).toBe(60);
    expect(q.recycleCount).toBe(0);
    // The 61st pick recycles instead of looping forever.
    const again = q.next(ref, 'normal');
    expect(again).not.toBeNull();
    expect(q.recycleCount).toBe(1);
  });

  it('respects difficulty bands on large pools', () => {
    const values = range(1000);
    const pool = makePool(values);
    const p = percentileRanks(values);
    for (const [difficulty, check] of [
      ['easy', (d: number) => d >= 0.3 - 1e-9],
      ['hard', (d: number) => d <= 0.12 + 1e-9],
    ] as const) {
      const q = new ChallengerQueue(pool, createRng(5));
      let ref = q.pickStart(difficulty)!;
      for (let i = 0; i < 100; i++) {
        const c = q.next(ref, difficulty)!;
        expect(check(Math.abs(p[c]! - p[ref]!))).toBe(true);
        ref = c;
      }
    }
  });

  it('hard comparisons are closer than easy ones on average', () => {
    const pool = makePool(range(500));
    const avgGap = (difficulty: 'easy' | 'hard') => {
      const q = new ChallengerQueue(pool, createRng(11));
      let ref = q.pickStart(difficulty)!;
      let total = 0;
      for (let i = 0; i < 100; i++) {
        const c = q.next(ref, difficulty)!;
        total += Math.abs(pool.percentiles[c]! - pool.percentiles[ref]!);
        ref = c;
      }
      return total / 100;
    };
    expect(avgGap('hard')).toBeLessThan(avgGap('easy') / 3);
  });

  it('asks both directions', () => {
    const pool = makePool(range(400));
    const q = new ChallengerQueue(pool, createRng(21));
    let ref = q.pickStart('normal')!;
    let higher = 0;
    for (let i = 0; i < 200; i++) {
      const c = q.next(ref, 'normal')!;
      if (pool.facts[c]!.value > pool.facts[ref]!.value) higher++;
      ref = c;
    }
    expect(higher).toBeGreaterThan(60);
    expect(higher).toBeLessThan(140);
  });

  it('terminates on tiny and degenerate pools', () => {
    expect(new ChallengerQueue(makePool([1]), createRng(1)).pickStart('normal')).toBeNull();
    const allEqual = new ChallengerQueue(makePool([4, 4, 4, 4]), createRng(1));
    expect(allEqual.pickStart('normal')).toBeNull();
    const two = makePool([1, 2]);
    const q = new ChallengerQueue(two, createRng(1));
    let ref = q.pickStart('hard')!;
    for (let i = 0; i < 20; i++) {
      const c = q.next(ref, 'hard');
      expect(c).not.toBeNull();
      expect(c).not.toBe(ref);
      ref = c!;
    }
  });

  it('is reproducible with the same seed', () => {
    const pool = makePool(range(300));
    const run = () => {
      const q = new ChallengerQueue(pool, createRng(1234));
      const seq = [q.pickStart('normal')!];
      for (let i = 0; i < 30; i++) seq.push(q.next(seq.at(-1)!, 'normal')!);
      return seq;
    };
    expect(run()).toEqual(run());
  });
});
