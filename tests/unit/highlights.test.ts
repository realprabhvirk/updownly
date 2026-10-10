import { describe, expect, it } from 'vitest';
import { BOTTOM_N, TOP_N, barFraction, factOfTheDay, hasMeaningfulBottom, highlightCount, ranked } from '../../src/data/highlights';
import { makeFacts } from './helpers';

describe('highlights', () => {
  const facts = makeFacts([5, -3, 12, 12, 0, 40, Number.NaN]);

  it('ranks highest first and lowest first', () => {
    expect(ranked(facts, 'highest', 3).map((f) => f.value)).toEqual([40, 12, 12]);
    expect(ranked(facts, 'lowest', 3).map((f) => f.value)).toEqual([-3, 0, 5]);
  });

  it('drops non-finite values and respects the limit', () => {
    expect(ranked(facts, 'highest', 100)).toHaveLength(6);
    expect(ranked(facts, 'lowest', 0)).toEqual([]);
  });

  it('breaks ties by name so the order is stable', () => {
    const [a, b] = ranked(facts, 'highest', 3).slice(1);
    expect(a!.entityName.localeCompare(b!.entityName)).toBeLessThan(0);
  });

  it('does not mutate the input', () => {
    const before = facts.map((f) => f.id);
    ranked(facts, 'highest', 3);
    expect(facts.map((f) => f.id)).toEqual(before);
  });

  it('counts highlights without double-counting small pools', () => {
    expect(highlightCount(1000)).toBe(TOP_N + BOTTOM_N);
    expect(highlightCount(40)).toBe(40);
    expect(highlightCount(1000, false)).toBe(TOP_N);
  });

  it('skips bottom lists for pools with an inclusion floor', () => {
    expect(hasMeaningfulBottom('wikidata')).toBe(false);
    expect(hasMeaningfulBottom('worldbank-wdi')).toBe(true);
  });

  it('scales bars within the visible range, including negatives', () => {
    expect(barFraction(-259, -259, 3422)).toBe(0.04);
    expect(barFraction(3422, -259, 3422)).toBe(1);
    expect(barFraction(5, 5, 5)).toBe(1);
  });

  it('picks a deterministic fact of the day', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(factOfTheDay('2026-10-10', ids)).toEqual(factOfTheDay('2026-10-10', [...ids].reverse()));
    const pick = factOfTheDay('2026-10-10', ids)!;
    expect(ids).toContain(pick.collectionId);
    expect(pick.rank).toBeGreaterThanOrEqual(0);
    expect(pick.rank).toBeLessThan(10);
    expect(factOfTheDay('2026-10-10', [])).toBeNull();
  });
});
