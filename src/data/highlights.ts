/**
 * Highlights for the Facts section: the record holders at both ends of
 * every collection. Pure functions over bundled facts — no new data.
 */
import { hashString } from '../game/rng';
import type { Fact } from './schema';

/** How many facts each end of a collection contributes. */
export const TOP_N = 50;
export const BOTTOM_N = 20;

export type RankOrder = 'highest' | 'lowest';

/** Facts sorted from the requested end; ties broken by name for stability. */
export function ranked(facts: readonly Fact[], order: RankOrder, limit: number): Fact[] {
  const dir = order === 'highest' ? -1 : 1;
  return facts
    .filter((f) => Number.isFinite(f.value))
    .slice()
    .sort((a, b) => dir * (a.value - b.value) || a.entityName.localeCompare(b.entityName))
    .slice(0, Math.max(0, limit));
}

/**
 * Wikidata pools are built with an inclusion floor (peaks ≥ 1,000 m,
 * stadiums ≥ 5,000 seats…), so their low end is the cut-off, not a real
 * record. Only show a "bottom" list where the lowest values mean something.
 */
export function hasMeaningfulBottom(sourceId: string): boolean {
  return sourceId !== 'wikidata';
}

/** Distinct facts a collection of `count` contributes to the section. */
export function highlightCount(count: number, withBottom = true): number {
  return Math.min(count, TOP_N + (withBottom ? BOTTOM_N : 0));
}

/**
 * Bar length in [0.04, 1] for a value within a displayed list. Uses the
 * list's own range so negatives (°C) and huge spreads still read clearly.
 */
export function barFraction(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 1;
  return Math.max(0.04, Math.min(1, (value - min) / (max - min)));
}

/** Deterministic "fact of the day": a collection and a top-10 rank. */
export function factOfTheDay(dateKey: string, collectionIds: readonly string[]): { collectionId: string; rank: number } | null {
  if (collectionIds.length === 0) return null;
  const sorted = [...collectionIds].sort();
  const h = hashString(`updownly|fact-of-the-day|${dateKey}`);
  return { collectionId: sorted[h % sorted.length]!, rank: (h >>> 8) % 10 };
}
