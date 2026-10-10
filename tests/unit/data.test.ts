/**
 * Tests against the real bundled dataset — the same files the app ships.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/data/catalog';
import { ALLOWED_LICENCES, COLLECTIONS, GROUPS, METRICS, SOURCES } from '../../src/data/definitions';
import { expandRow } from '../../src/data/loader';
import type { CollectionFile, DataManifest } from '../../src/data/schema';
import { MIN_COLLECTIONS, MIN_TOTAL_FACTS, tieProbability, validateDataset } from '../../src/data/validate';
import { dailySequence } from '../../src/game/daily';
import { buildPool, isValidPair } from '../../src/game/queue';

const dir = 'src/data/generated';
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8')) as DataManifest;
const files = readdirSync(`${dir}/facts`)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`${dir}/facts/${f}`, 'utf8')) as CollectionFile);

describe('bundled dataset', () => {
  const result = validateDataset({
    manifest,
    files,
    collections: COLLECTIONS,
    metrics: METRICS,
    sources: SOURCES,
    allowedLicences: ALLOWED_LICENCES,
  });

  it('passes validation with no errors', () => {
    expect(result.errors).toEqual([]);
  });

  it('meets the volume requirements, counted from actual records', () => {
    const actual = files.reduce((n, f) => n + f.facts.length, 0);
    expect(actual).toBe(manifest.totalFacts);
    expect(actual).toBeGreaterThanOrEqual(MIN_TOTAL_FACTS);
    expect(CATALOG.length).toBeGreaterThanOrEqual(MIN_COLLECTIONS);
    expect(new Set(CATALOG.map((c) => c.groupId)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(files.map((f) => f.sourceId)).size).toBeGreaterThanOrEqual(4);
  });

  it('has globally unique fact ids', () => {
    const ids = new Set<string>();
    for (const f of files) {
      for (const row of f.facts) {
        const id = `${f.collectionId}:${row[0]}`;
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    }
  });

  it('every fact is traceable to a licensed source', () => {
    for (const f of files) {
      const source = manifest.sources.find((s) => s.id === f.sourceId);
      expect(source, f.collectionId).toBeDefined();
      expect(ALLOWED_LICENCES).toContain(source!.licence);
      for (const row of f.facts) expect(row[3], `${f.collectionId}/${row[0]}`).toBeTruthy();
    }
  });

  it('every value is finite and every unit matches its metric', () => {
    for (const f of files) {
      const metric = METRICS.find((m) => m.id === f.metricId)!;
      expect(f.unit).toBe(metric.unit);
      for (const row of f.facts) expect(Number.isFinite(row[2])).toBe(true);
    }
  });

  it('each collection is a single comparison group with one period', () => {
    for (const f of files) {
      const facts = f.facts.map((r) => expandRow(f, r));
      expect(new Set(facts.map((x) => x.comparisonGroupId)).size).toBe(1);
      expect(new Set(facts.map((x) => x.periodKey)).size).toBe(1);
      expect(new Set(facts.map((x) => x.unit)).size).toBe(1);
    }
  });

  it('no two collections share a comparison group', () => {
    const groups = files.map((f) => f.comparisonGroupId);
    expect(new Set(groups).size).toBe(groups.length);
  });

  it('collections are not equality-heavy', () => {
    for (const f of files) expect(tieProbability(f.facts.map((r) => r[2])), f.collectionId).toBeLessThan(0.2);
  });

  it('every group has at least one playable collection', () => {
    for (const g of GROUPS) expect(CATALOG.some((c) => c.groupId === g.id), g.id).toBe(true);
  });

  it('expanded facts carry provenance and links', () => {
    const f = files.find((x) => x.collectionId === 'world-population')!;
    const fact = expandRow(f, f.facts[0]!);
    expect(fact.sourceUrl).toMatch(/^https:\/\/data\.worldbank\.org\/indicator\/SP\.POP\.TOTL\?locations=/);
    expect(fact.periodLabel).toMatch(/^\d{4}$/);
  });

  it('every featured collection can produce a full, fair daily challenge', () => {
    for (const c of CATALOG.filter((x) => x.featured)) {
      const f = files.find((x) => x.collectionId === c.id)!;
      const pool = buildPool(
        f.facts.map((r) => expandRow(f, r)),
        c.metric,
      );
      const seq = dailySequence('2026-10-10', pool);
      expect(seq, c.id).toHaveLength(11);
      for (let i = 1; i < seq.length; i++) expect(isValidPair(pool, seq[i - 1]!, seq[i]!)).toBe(true);
    }
  });
});
