/**
 * `npm run data:build` — turns raw downloads (data/raw/) into the
 * app-ready dataset in src/data/generated/. Offline; deterministic for a
 * given set of raw files.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { COLLECTIONS, SOURCES, metricById } from '../../src/data/definitions.ts';
import type { CollectionFile, CompactFactRow, DataManifest, FactSource } from '../../src/data/schema.ts';
import { exists } from './lib/http.ts';
import { ExclusionLog, type BuiltCollection } from './lib/types.ts';
import { buildAmniote } from './sources/amniote.ts';
import { buildExoplanets } from './sources/exoplanets.ts';
import { buildOurAirports } from './sources/ourairports.ts';
import { buildPubchem } from './sources/pubchem.ts';
import { buildUsda } from './sources/usda.ts';
import { buildWikidata } from './sources/wikidata.ts';
import { buildWorldBank } from './sources/worldbank.ts';

const OUT = 'src/data/generated';
/** Bump when the shape or selection rules of the dataset change. */
export const DATA_VERSION = '2026.10.1';

const log = new ExclusionLog();
const built: BuiltCollection[] = [
  ...(await buildWorldBank(log)),
  ...(await buildExoplanets(log)),
  ...(await buildOurAirports(log)),
  ...(await buildUsda(log)),
  ...(await buildPubchem(log)),
  ...(await buildAmniote(log)),
  ...(await buildWikidata(log)),
];

// Cross-field check: a skyscraper's height per floor should be plausible
// (2.4–8 m). When it is not, one of the two records is wrong and we cannot
// tell which, so the building is dropped from both collections.
{
  const height = built.find((x) => x.collectionId === 'buildings-skyscraper-height')!;
  const floors = built.find((x) => x.collectionId === 'buildings-skyscraper-floors')!;
  const h = new Map(height.facts.map((f) => [f.entityId, f.value]));
  const bad = new Set<string>();
  for (const f of floors.facts) {
    const metres = h.get(f.entityId);
    if (metres === undefined) {
      // Only a handful of towers exceed 120 floors; demand corroboration.
      if (f.value > 120) bad.add(f.entityId);
      continue;
    }
    const perFloor = metres / f.value;
    if (perFloor < 2.4 || perFloor > 8) bad.add(f.entityId);
  }
  for (const col of [height, floors]) {
    col.facts = col.facts.filter((f) => {
      if (!bad.has(f.entityId)) return true;
      log.add(col.collectionId, 'height and floor count inconsistent or uncorroborated', `${f.entityId} ${f.name}`);
      return false;
    });
  }
}

await rm(join(OUT, 'facts'), { recursive: true, force: true });
await mkdir(join(OUT, 'facts'), { recursive: true });

const manifest: DataManifest = {
  generatedAt: new Date().toISOString().slice(0, 10),
  dataVersion: DATA_VERSION,
  totalFacts: 0,
  totalEntities: 0,
  collections: [],
  sources: [],
};
const entities = new Set<string>();

for (const def of COLLECTIONS) {
  const b = built.find((x) => x.collectionId === def.id);
  if (!b) throw new Error(`No builder produced collection ${def.id}`);
  const metric = metricById(def.metricId);
  if (!metric) throw new Error(`Unknown metric ${def.metricId}`);

  // Generic hygiene: finite values, non-empty names, unique ids, and no
  // two entities a player could not tell apart (same name and context).
  const seenIds = new Set<string>();
  const nameKey = new Map<string, number>();
  for (const f of b.facts) nameKey.set(`${f.name}\u0000${f.context ?? ''}`, (nameKey.get(`${f.name}\u0000${f.context ?? ''}`) ?? 0) + 1);
  const rows: CompactFactRow[] = [];
  for (const f of b.facts) {
    const name = f.name.trim();
    if (!name) {
      log.add(def.id, 'empty name', f.entityId);
      continue;
    }
    if (!Number.isFinite(f.value)) {
      log.add(def.id, 'non-finite value', name);
      continue;
    }
    if (seenIds.has(f.entityId)) {
      log.add(def.id, 'duplicate entity in source', name);
      continue;
    }
    if ((nameKey.get(`${f.name}\u0000${f.context ?? ''}`) ?? 0) > 1) {
      log.add(def.id, 'indistinguishable from another entity (same name and context)', name);
      continue;
    }
    seenIds.add(f.entityId);
    entities.add(`${def.sourceId}:${f.entityId}`);
    const row: CompactFactRow = [f.entityId, name, f.value];
    if (f.sourceRecordId || f.context || f.note) row.push(f.sourceRecordId ?? null);
    if (f.context || f.note) row.push(f.context ?? null);
    if (f.note) row.push(f.note);
    rows.push(row);
  }
  rows.sort((a, b2) => (a[0] < b2[0] ? -1 : a[0] > b2[0] ? 1 : 0));

  const file: CollectionFile = {
    collectionId: def.id,
    metricId: def.metricId,
    comparisonGroupId: `${def.metricId}|${def.id}|${b.periodKey}`,
    unit: metric.unit,
    periodKey: b.periodKey,
    periodLabel: b.periodLabel,
    sourceId: b.sourceId,
    facts: rows,
  };
  await writeFile(join(OUT, 'facts', `${def.id}.json`), JSON.stringify(file));
  const values = rows.map((r) => r[2]);
  manifest.collections.push({
    id: def.id,
    count: rows.length,
    periodKey: b.periodKey,
    periodLabel: b.periodLabel,
    min: Math.min(...values),
    max: Math.max(...values),
  });
  manifest.totalFacts += rows.length;
  console.log(`  ${def.id.padEnd(30)} ${String(rows.length).padStart(6)}  (${b.periodLabel})`);
}

for (const s of SOURCES) {
  const stamp = join('data/raw', `${s.id}.retrieved`);
  const retrievedAt = (await exists(stamp)) ? (await readFile(stamp, 'utf8')).trim() : manifest.generatedAt;
  manifest.sources.push({ ...s, retrievedAt } satisfies FactSource);
}
manifest.totalEntities = entities.size;

await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile('data/exclusions.json', JSON.stringify(log.toJSON(), null, 1) + '\n');
console.log(`\n${manifest.totalFacts} facts · ${manifest.totalEntities} entities · ${manifest.collections.length} collections`);
