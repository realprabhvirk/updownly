/**
 * End-to-end test fixtures (only bundled when building with --mode e2e).
 * They stress layout with very long names and very large values. They are
 * clearly synthetic and never ship in production builds.
 */
import { registerCatalogEntry } from './catalog';
import { GROUPS, METRICS, SOURCES } from './definitions';
import { registerCollectionFile } from './loader';
import type { CollectionFile, CompactFactRow } from './schema';

export function registerFixtures(): void {
  const metric = METRICS.find((m) => m.id === 'population')!;
  const names = [
    'The United Kingdom of Great Britain and Northern Ireland',
    'Saint Vincent and the Grenadines Extremely Long Fixture Name',
    'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch',
    'Short',
    'Wolfeschlegelsteinhausenbergerdorff Fixture Entity',
    'Bosnia and Herzegovina — Federation and Republika Srpska',
  ];
  const facts: CompactFactRow[] = Array.from({ length: 60 }, (_, i) => [
    `fx${i}`,
    `${names[i % names.length]} ${i + 1}`,
    Math.round(10 ** (3 + (i % 10)) * (1 + i / 7)),
    `fx${i}`,
    'Fixture context that is also rather long to test wrapping',
  ]);
  const file: CollectionFile = {
    collectionId: 'e2e-extremes',
    metricId: metric.id,
    comparisonGroupId: `${metric.id}|e2e-extremes|fixture`,
    unit: metric.unit,
    periodKey: 'fixture',
    periodLabel: 'Test fixture',
    sourceId: 'wikidata',
    facts,
  };
  registerCollectionFile(file);
  const source = { ...SOURCES.find((s) => s.id === 'wikidata')!, retrievedAt: '2026-01-01' };
  registerCatalogEntry({
    id: 'e2e-extremes',
    groupId: 'culture',
    metricId: metric.id,
    sourceId: 'wikidata',
    title: 'Test fixture',
    subtitle: 'Long names',
    descriptor: 'Synthetic layout stress test.',
    description: 'Synthetic values used only by automated tests.',
    icon: 'squares-four',
    entityNoun: 'item',
    group: GROUPS.find((g) => g.id === 'culture')!,
    metric,
    source,
    count: facts.length,
    periodLabel: 'Test fixture',
    periodKey: 'fixture',
  });
}
