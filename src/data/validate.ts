/**
 * Dataset validation shared by `npm run data:validate` and the unit tests.
 * Pure: takes the manifest, collection files and definitions, returns
 * errors (build-blocking), warnings (reported, not blocking) and stats.
 */
import type { CollectionDefinition, CollectionFile, DataManifest, FactSource, MetricDefinition } from './schema';

export const MIN_TOTAL_FACTS = 10_000;
export const MIN_COLLECTIONS = 20;
export const MIN_GROUPS = 6;
export const MIN_POOL_SIZE = 40;
export const MIN_DISTINCT_VALUES = 25;
/** Probability that two random facts in a pool tie. Above this → error. */
export const MAX_TIE_PROBABILITY = 0.2;
export const WARN_TIE_PROBABILITY = 0.05;

export type CollectionStats = {
  id: string;
  count: number;
  distinctValues: number;
  tieProbability: number;
  outliers: number;
};

export type ValidationResult = {
  errors: string[];
  warnings: string[];
  stats: {
    totalFacts: number;
    totalEntities: number;
    collections: number;
    groups: number;
    perCollection: CollectionStats[];
  };
};

type Input = {
  manifest: DataManifest;
  files: CollectionFile[];
  collections: CollectionDefinition[];
  metrics: MetricDefinition[];
  sources: Array<Omit<FactSource, 'retrievedAt'>>;
  allowedLicences: string[];
};

const PERIOD_KEY = /^[a-z0-9][a-z0-9-]{0,31}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Probability that two distinct, randomly chosen facts share a value. */
export function tieProbability(values: number[]): number {
  const n = values.length;
  if (n < 2) return 1;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let pairs = 0;
  for (const c of counts.values()) pairs += (c * (c - 1)) / 2;
  return pairs / ((n * (n - 1)) / 2);
}

/**
 * Count values outside 3×IQR fences on a log scale. Only meaningful for
 * strictly positive data; other pools are range-checked by the pipeline.
 */
export function countOutliers(values: number[]): number {
  if (values.length < 20 || !values.every((v) => v > 0)) return 0;
  const xs = values.map(Math.log10).sort((a, b) => a - b);
  const q = (p: number) => xs[Math.floor(p * (xs.length - 1))]!;
  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return 0;
  return xs.filter((x) => x < q1 - 3 * iqr || x > q3 + 3 * iqr).length;
}

export function validateDataset(input: Input): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const perCollection: CollectionStats[] = [];
  const { manifest, files, collections, metrics, sources, allowedLicences } = input;

  const metricIds = new Map(metrics.map((m) => [m.id, m]));
  const sourceIds = new Map(sources.map((s) => [s.id, s]));
  const fileById = new Map(files.map((f) => [f.collectionId, f]));
  const groupIds = new Set<string>();
  const comparisonGroups = new Map<string, string>();
  const entities = new Set<string>();
  let totalFacts = 0;

  // Definitions sanity.
  const defIds = new Set<string>();
  for (const def of collections) {
    if (defIds.has(def.id)) errors.push(`Duplicate collection definition ${def.id}`);
    defIds.add(def.id);
    if (!metricIds.has(def.metricId)) errors.push(`${def.id}: unknown metric "${def.metricId}"`);
    if (!sourceIds.has(def.sourceId)) errors.push(`${def.id}: unknown source "${def.sourceId}"`);
  }
  for (const m of metrics) {
    if (!m.unit || !m.label) errors.push(`Metric ${m.id}: missing unit or label`);
  }
  for (const s of sources) {
    if (!allowedLicences.includes(s.licence)) errors.push(`Source ${s.id}: unsupported licence "${s.licence}"`);
    if (!s.attribution) errors.push(`Source ${s.id}: missing attribution`);
    if (!/^https:\/\//.test(s.url)) errors.push(`Source ${s.id}: URL must be https`);
  }
  for (const s of manifest.sources) {
    if (!DATE.test(s.retrievedAt)) errors.push(`Source ${s.id}: retrievedAt "${s.retrievedAt}" is not YYYY-MM-DD`);
    if (!sourceIds.has(s.id)) errors.push(`Manifest lists unknown source ${s.id}`);
  }
  for (const f of files) {
    if (!defIds.has(f.collectionId)) errors.push(`Generated file for undefined collection ${f.collectionId}`);
  }

  for (const def of collections) {
    const file = fileById.get(def.id);
    if (!file) {
      errors.push(`${def.id}: no generated data file`);
      continue;
    }
    const metric = metricIds.get(def.metricId);
    const where = def.id;
    if (file.metricId !== def.metricId) errors.push(`${where}: metric ${file.metricId} ≠ definition ${def.metricId}`);
    if (metric && file.unit !== metric.unit) errors.push(`${where}: unit "${file.unit}" ≠ metric unit "${metric.unit}"`);
    if (file.sourceId !== def.sourceId) errors.push(`${where}: source ${file.sourceId} ≠ definition ${def.sourceId}`);
    if (!PERIOD_KEY.test(file.periodKey)) errors.push(`${where}: invalid periodKey "${file.periodKey}"`);
    if (!file.periodLabel.trim()) errors.push(`${where}: empty periodLabel`);
    const expectedGroup = `${def.metricId}|${def.id}|${file.periodKey}`;
    if (file.comparisonGroupId !== expectedGroup) {
      errors.push(`${where}: comparisonGroupId "${file.comparisonGroupId}" should be "${expectedGroup}"`);
    }
    const prior = comparisonGroups.get(file.comparisonGroupId);
    if (prior && prior !== `${file.metricId}|${file.unit}`) {
      errors.push(`${where}: comparison group shared with incompatible metric/unit`);
    }
    comparisonGroups.set(file.comparisonGroupId, `${file.metricId}|${file.unit}`);

    const ids = new Set<string>();
    const names = new Set<string>();
    const values: number[] = [];
    for (const row of file.facts) {
      const [entityId, name, value, sourceRecordId, context] = row;
      if (typeof entityId !== 'string' || !entityId || /\s/.test(entityId)) {
        errors.push(`${where}: invalid entity id ${JSON.stringify(entityId)}`);
        continue;
      }
      if (ids.has(entityId)) errors.push(`${where}: duplicate observation for entity ${entityId}`);
      ids.add(entityId);
      if (typeof name !== 'string' || !name.trim()) errors.push(`${where}/${entityId}: empty name`);
      else if (name.length > 120) warnings.push(`${where}/${entityId}: very long name (${name.length} chars)`);
      const key = `${name}\u0000${context ?? ''}`;
      if (names.has(key)) errors.push(`${where}/${entityId}: indistinguishable duplicate "${name}"`);
      names.add(key);
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${where}/${entityId}: non-finite value ${String(value)}`);
        continue;
      }
      if (metric?.format === 'percent' && (value < 0 || value > 100)) {
        errors.push(`${where}/${entityId}: percentage ${value} outside 0–100`);
      }
      if (metric && metric.unit !== 'celsius' && value < 0 && def.metricId !== 'airport-elevation') {
        errors.push(`${where}/${entityId}: negative value ${value} for ${metric.unit}`);
      }
      if (!sourceRecordId) errors.push(`${where}/${entityId}: missing source record reference`);
      values.push(value);
      entities.add(`${def.sourceId}:${entityId}`);
    }

    const distinct = new Set(values).size;
    const ties = tieProbability(values);
    const outliers = countOutliers(values);
    perCollection.push({ id: def.id, count: values.length, distinctValues: distinct, tieProbability: ties, outliers });
    if (values.length < MIN_POOL_SIZE) errors.push(`${where}: only ${values.length} facts (minimum ${MIN_POOL_SIZE})`);
    if (distinct < MIN_DISTINCT_VALUES) errors.push(`${where}: only ${distinct} distinct values`);
    if (ties > MAX_TIE_PROBABILITY) errors.push(`${where}: equality-heavy (tie probability ${ties.toFixed(3)})`);
    else if (ties > WARN_TIE_PROBABILITY) warnings.push(`${where}: many tied values (tie probability ${ties.toFixed(3)})`);
    if (outliers > 0) warnings.push(`${where}: ${outliers} statistical outlier(s) beyond 3×IQR — review, not removed`);

    const m = manifest.collections.find((c) => c.id === def.id);
    if (!m) errors.push(`${where}: missing from manifest`);
    else if (m.count !== values.length) errors.push(`${where}: manifest count ${m.count} ≠ actual ${values.length}`);

    totalFacts += values.length;
    groupIds.add(def.groupId);
  }

  if (manifest.totalFacts !== totalFacts) {
    errors.push(`Manifest totalFacts ${manifest.totalFacts} ≠ actual ${totalFacts}`);
  }
  if (totalFacts < MIN_TOTAL_FACTS) errors.push(`Only ${totalFacts} facts (minimum ${MIN_TOTAL_FACTS})`);
  if (collections.length < MIN_COLLECTIONS) errors.push(`Only ${collections.length} collections (minimum ${MIN_COLLECTIONS})`);
  if (groupIds.size < MIN_GROUPS) errors.push(`Only ${groupIds.size} category groups (minimum ${MIN_GROUPS})`);

  return {
    errors,
    warnings,
    stats: { totalFacts, totalEntities: entities.size, collections: collections.length, groups: groupIds.size, perCollection },
  };
}
