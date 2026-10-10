/**
 * Daily Challenge: one category and one fixed sequence of ten comparisons
 * per local calendar date, derived from the date and a versioned seed.
 * Bump DAILY_ALGORITHM_VERSION whenever the selection rules or bundled
 * data change in a way that would alter sequences, so changes are
 * deliberate and visible.
 */
import { ChallengerQueue, type Pool } from './queue';
import { createRng, hashString } from './rng';
import { DAILY_QUESTIONS } from './types';

export const DAILY_ALGORITHM_VERSION = 1;
export const DAILY_DIFFICULTY = 'normal' as const;

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d + delta, 12); // midday avoids DST edges
  return localDateKey(date);
}

const seedFor = (dateKey: string, salt: string) =>
  hashString(`updownly|daily|v${DAILY_ALGORITHM_VERSION}|${salt}|${dateKey}`);

/** Deterministic collection for a date; never the same as the day before. */
export function dailyCollectionId(dateKey: string, eligible: readonly string[]): string {
  if (eligible.length === 0) throw new Error('No daily-eligible collections');
  const sorted = [...eligible].sort();
  const pick = (key: string) => seedFor(key, 'collection') % sorted.length;
  let i = pick(dateKey);
  if (sorted.length > 1 && i === pick(addDays(dateKey, -1))) i = (i + 1) % sorted.length;
  return sorted[i]!;
}

/**
 * Pool indices for the day: [reference, challenger 1 … challenger 10].
 * Depends only on the date, the algorithm version and the pool contents.
 */
export function dailySequence(dateKey: string, pool: Pool): number[] {
  const rng = createRng(seedFor(dateKey, 'sequence'));
  const queue = new ChallengerQueue(pool, rng);
  const start = queue.pickStart(DAILY_DIFFICULTY);
  if (start === null) return [];
  const seq = [start];
  for (let i = 0; i < DAILY_QUESTIONS; i++) {
    const next = queue.next(seq[seq.length - 1]!, DAILY_DIFFICULTY);
    if (next === null) break;
    seq.push(next);
  }
  return seq;
}

/** Consecutive-day participation streak ending today (or yesterday). */
export function dailyStreak(completedDates: Iterable<string>, today: string): number {
  const set = new Set(completedDates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
