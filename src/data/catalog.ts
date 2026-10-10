/**
 * The playable catalogue: definitions joined with generated counts. A
 * collection only appears if its bundled pool is large enough to play.
 */
import manifest from './generated/manifest.json';
import { COLLECTIONS, GROUPS, METRICS } from './definitions';
import type { CategoryGroup, CollectionDefinition, DataManifest, FactSource, MetricDefinition } from './schema';
import { MIN_POOL_SIZE } from './validate';

export type CollectionInfo = CollectionDefinition & {
  group: CategoryGroup;
  metric: MetricDefinition;
  source: FactSource;
  count: number;
  periodLabel: string;
  periodKey: string;
};

export const DATA_MANIFEST = manifest as DataManifest;

const extra: CollectionInfo[] = [];

function join(def: CollectionDefinition): CollectionInfo | null {
  const m = DATA_MANIFEST.collections.find((c) => c.id === def.id);
  const metric = METRICS.find((x) => x.id === def.metricId);
  const source = DATA_MANIFEST.sources.find((s) => s.id === def.sourceId);
  const group = GROUPS.find((g) => g.id === def.groupId);
  if (!m || !metric || !source || !group || m.count < MIN_POOL_SIZE) return null;
  return { ...def, group, metric, source, count: m.count, periodLabel: m.periodLabel, periodKey: m.periodKey };
}

export const CATALOG: CollectionInfo[] = COLLECTIONS.map(join).filter((c): c is CollectionInfo => c !== null);

/** E2E fixtures only. */
export function registerCatalogEntry(info: CollectionInfo): void {
  extra.push(info);
}

export function allCollections(): CollectionInfo[] {
  return [...CATALOG, ...extra];
}

export function collectionInfo(id: string): CollectionInfo | undefined {
  return allCollections().find((c) => c.id === id);
}

export function featuredCollections(): CollectionInfo[] {
  return CATALOG.filter((c) => c.featured);
}

export const TOTAL_FACTS = DATA_MANIFEST.totalFacts;
