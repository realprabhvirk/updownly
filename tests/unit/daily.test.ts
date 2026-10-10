import { describe, expect, it } from 'vitest';
import { addDays, dailyCollectionId, dailySequence, dailyStreak, localDateKey } from '../../src/game/daily';
import { isValidPair } from '../../src/game/queue';
import { makePool } from './helpers';

const pool = makePool(Array.from({ length: 300 }, (_, i) => i * 3 + 1));
const ELIGIBLE = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('daily', () => {
  it('formats local dates', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('produces 11 facts → exactly ten comparisons', () => {
    expect(dailySequence('2026-10-10', pool)).toHaveLength(11);
  });

  it('is reproducible for the same date', () => {
    expect(dailySequence('2026-10-10', pool)).toEqual(dailySequence('2026-10-10', pool));
    expect(dailyCollectionId('2026-10-10', ELIGIBLE)).toBe(dailyCollectionId('2026-10-10', ELIGIBLE));
  });

  it('changes on a new date', () => {
    expect(dailySequence('2026-10-11', pool)).not.toEqual(dailySequence('2026-10-10', pool));
  });

  it('does not depend on the order of eligible collections', () => {
    expect(dailyCollectionId('2026-10-10', ELIGIBLE)).toBe(dailyCollectionId('2026-10-10', [...ELIGIBLE].reverse()));
  });

  it('never repeats the previous day’s collection', () => {
    let d = '2026-01-01';
    for (let i = 0; i < 200; i++) {
      const next = addDays(d, 1);
      expect(dailyCollectionId(next, ELIGIBLE)).not.toBe(dailyCollectionId(d, ELIGIBLE));
      d = next;
    }
  });

  it('contains only fair pairs and no repeated facts', () => {
    const seq = dailySequence('2026-10-10', pool);
    expect(new Set(seq).size).toBe(seq.length);
    for (let i = 1; i < seq.length; i++) expect(isValidPair(pool, seq[i - 1]!, seq[i]!)).toBe(true);
  });

  it('computes consecutive-day streaks', () => {
    expect(dailyStreak(['2026-10-08', '2026-10-09', '2026-10-10'], '2026-10-10')).toBe(3);
    expect(dailyStreak(['2026-10-08', '2026-10-09'], '2026-10-10')).toBe(2); // today not played yet
    expect(dailyStreak(['2026-10-07', '2026-10-09', '2026-10-10'], '2026-10-10')).toBe(2);
    expect(dailyStreak(['2026-10-01'], '2026-10-10')).toBe(0);
    expect(dailyStreak([], '2026-10-10')).toBe(0);
  });
});
