/**
 * Loads bundled collection data. The manifest is tiny and bundled eagerly;
 * each collection's facts live in their own chunk, loaded on demand and
 * precached by the service worker so every collection works offline.
 */
import { buildPool, type Pool } from '../game/queue';
import { collectionById, metricById, sourceDefById } from './definitions';
import type { CollectionFile, CompactFactRow, Fact } from './schema';

const modules = import.meta.glob<CollectionFile>('./generated/facts/*.json', { import: 'default' });

/** Extra collections registered at runtime (end-to-end test fixtures only). */
const extraFiles = new Map<string, CollectionFile>();

export function registerCollectionFile(file: CollectionFile): void {
  extraFiles.set(file.collectionId, file);
}

export function recordUrl(collectionId: string, sourceId: string, sourceRecordId?: string): string | undefined {
  if (!sourceRecordId) return undefined;
  const template = collectionById(collectionId)?.recordUrlTemplate ?? sourceDefById(sourceId)?.recordUrlTemplate;
  return template ? template.replace('{id}', encodeURIComponent(sourceRecordId)) : undefined;
}

export function expandRow(file: CollectionFile, row: CompactFactRow): Fact {
  const [entityId, name, value, sourceRecordId, context, note] = row;
  const fact: Fact = {
    id: `${file.collectionId}:${entityId}`,
    entityId,
    entityName: name,
    categoryId: file.collectionId,
    metricId: file.metricId,
    comparisonGroupId: file.comparisonGroupId,
    value,
    unit: file.unit,
    periodKey: file.periodKey,
    periodLabel: file.periodLabel,
    sourceId: file.sourceId,
  };
  if (context) fact.context = context;
  if (note) fact.note = note;
  if (sourceRecordId) {
    fact.sourceRecordId = sourceRecordId;
    const url = recordUrl(file.collectionId, file.sourceId, sourceRecordId);
    if (url) fact.sourceUrl = url;
  }
  return fact;
}

const fileCache = new Map<string, Promise<CollectionFile>>();
const poolCache = new Map<string, Promise<Pool>>();

export function loadCollectionFile(collectionId: string): Promise<CollectionFile> {
  const extra = extraFiles.get(collectionId);
  if (extra) return Promise.resolve(extra);
  let p = fileCache.get(collectionId);
  if (!p) {
    const loader = modules[`./generated/facts/${collectionId}.json`];
    if (!loader) return Promise.reject(new Error(`Unknown collection ${collectionId}`));
    p = loader().catch((err: unknown) => {
      fileCache.delete(collectionId); // allow a retry after a transient failure
      throw err;
    });
    fileCache.set(collectionId, p);
  }
  return p;
}

export async function loadFacts(collectionId: string): Promise<Fact[]> {
  const file = await loadCollectionFile(collectionId);
  return file.facts.map((row) => expandRow(file, row));
}

export function loadPool(collectionId: string): Promise<Pool> {
  let p = poolCache.get(collectionId);
  if (!p) {
    p = (async () => {
      const file = await loadCollectionFile(collectionId);
      const metric = metricById(file.metricId);
      if (!metric) throw new Error(`Unknown metric ${file.metricId}`);
      return buildPool(
        file.facts.map((row) => expandRow(file, row)),
        metric,
      );
    })();
    p.catch(() => poolCache.delete(collectionId));
    poolCache.set(collectionId, p);
  }
  return p;
}
