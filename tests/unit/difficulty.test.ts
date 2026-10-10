import { describe, expect, it } from 'vitest';
import { DIFFICULTY_BANDS, bandRanges, lowerBound, percentileRanks, upperBound } from '../../src/game/difficulty';

describe('percentileRanks', () => {
  it('spreads ranks evenly over [0, 1]', () => {
    expect(Array.from(percentileRanks([1, 2, 3, 4, 5]))).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('gives tied values the same average rank', () => {
    const p = percentileRanks([1, 2, 2, 2, 5]);
    expect(p[1]).toBe(p[2]);
    expect(p[2]).toBe(p[3]);
    expect(p[1]).toBe(0.5);
  });

  it('handles negatives and huge ranges identically', () => {
    expect(Array.from(percentileRanks([-259, -38, 0, 1e9]))).toEqual(Array.from(percentileRanks([1, 2, 3, 4])));
  });

  it('handles a single value', () => {
    expect(Array.from(percentileRanks([7]))).toEqual([0]);
  });
});

describe('bounds and bands', () => {
  const p = percentileRanks([...Array(101).keys()]); // 0.00 … 1.00

  it('binary searches correctly', () => {
    expect(lowerBound(p, 0.5)).toBe(50);
    expect(upperBound(p, 0.5)).toBe(51);
    expect(lowerBound(p, -1)).toBe(0);
    expect(upperBound(p, 2)).toBe(101);
  });

  it('easy band only contains distant items', () => {
    const ranges = bandRanges(p, 0.5, DIFFICULTY_BANDS.easy);
    for (const [s, e] of ranges) for (let i = s; i < e; i++) expect(Math.abs(p[i]! - 0.5)).toBeGreaterThanOrEqual(0.3 - 1e-9);
    expect(ranges.length).toBe(2);
  });

  it('hard band only contains near neighbours', () => {
    const ranges = bandRanges(p, 0.5, DIFFICULTY_BANDS.hard);
    for (const [s, e] of ranges) {
      for (let i = s; i < e; i++) {
        const d = Math.abs(p[i]! - 0.5);
        expect(d).toBeGreaterThanOrEqual(0.005 - 1e-9);
        expect(d).toBeLessThanOrEqual(0.12 + 1e-9);
      }
    }
  });

  it('returns one side at the extremes', () => {
    expect(bandRanges(p, 1, DIFFICULTY_BANDS.easy).length).toBe(1);
    expect(bandRanges(p, 0, DIFFICULTY_BANDS.easy).length).toBe(1);
  });
});
