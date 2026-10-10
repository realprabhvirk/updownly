import { describe, expect, it } from 'vitest';
import { createRng, hashString, randomInt, shuffle } from '../../src/game/rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 50 }, () => a());
    const ys = Array.from({ length: 50 }, () => b());
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('differs between seeds', () => {
    expect(createRng(1)()).not.toEqual(createRng(2)());
  });

  it('hashes strings stably', () => {
    expect(hashString('updownly')).toBe(hashString('updownly'));
    expect(hashString('2026-10-10')).not.toBe(hashString('2026-10-11'));
    // Pinned value: changing the hash would silently change every Daily.
    expect(hashString('abc')).toBe(440920331);
  });

  it('randomInt stays in range and covers it', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(rng, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('shuffle is a permutation', () => {
    const items = [...Array(20).keys()];
    const out = shuffle(items, createRng(3));
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(out).not.toEqual(items);
  });
});
