/**
 * Amniote Life-History Database (Myhrvold et al. 2015, Ecology 96:3109;
 * Ecological Archives E096-269), CC0 via figshare.
 *
 *  - "Adult body mass" is the database's mean adult body mass in grams.
 *  - "Maximum recorded lifespan" is the database's maximum longevity in
 *    years — a recorded maximum, never mixed with average lifespans.
 *
 * To keep the game about animals people can picture, a species is included
 * only if it has a common name and its Wikidata item is linked from at least
 * a class-specific number of Wikipedia language editions (a notability
 * filter; Wikidata is CC0). Bird and mammal articles are bot-generated in
 * some editions, so their thresholds are higher. The values themselves always come from the database.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseCsvObjects } from '../lib/csv.ts';
import { download, exists } from '../lib/http.ts';
import { sparqlCsv } from '../lib/sparql.ts';
import type { BuiltCollection, ExclusionLog } from '../lib/types.ts';

const RAW = 'data/raw/amniote';
const ZIP_URL = 'https://ndownloader.figshare.com/files/8067269';
const CSV = join(RAW, 'Data_Files', 'Amniote_Database_Aug_2015.csv');
const SITELINKS = join(RAW, 'taxon-sitelinks.csv');
export const MIN_SITELINKS = 12;
export const CLASS_MIN_SITELINKS: Record<string, number> = { Mammalia: 30, Aves: 40, Reptilia: 20 };

export async function fetchAmniote(force = false): Promise<void> {
  const zip = join(RAW, 'ECOL_96_269.zip');
  await download(ZIP_URL, zip, { force });
  if (force || !(await exists(CSV))) execFileSync('unzip', ['-q', '-o', zip, '-d', RAW]);
  if (force || !(await exists(SITELINKS))) {
    console.log('  ↓ Wikidata taxon sitelinks');
    const csv = await sparqlCsv(`SELECT ?name ?sitelinks WHERE {
  ?item wdt:P105 wd:Q7432 .
  ?item wdt:P225 ?name .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MIN_SITELINKS})
}`);
    await mkdir(RAW, { recursive: true });
    await writeFile(SITELINKS, csv);
  }
}

const CLASS_COLLECTION: Record<string, string> = {
  Mammalia: 'animals-mammal-mass',
  Aves: 'animals-bird-mass',
  Reptilia: 'animals-reptile-mass',
};
const CLASS_LABEL: Record<string, string> = { Mammalia: 'Mammal', Aves: 'Bird', Reptilia: 'Reptile' };

const titleCase = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');

/**
 * The database sometimes lists several names, or subspecies names in
 * brackets ("Sidewinder (cerastes: Mojave Desert Sidewinder; …)"). Keep the
 * first plain species name; reject anything still malformed.
 */
export function cleanCommonName(raw: string): string {
  const first = raw.split(',')[0]!.split(';')[0]!.replace(/\s*\(.*$/, '').trim();
  if (!first || first.includes(':') || first.includes(')')) return '';
  return titleCase(first);
}

export async function buildAmniote(log: ExclusionLog): Promise<BuiltCollection[]> {
  const rows = parseCsvObjects(await readFile(CSV, 'latin1'));
  const notable = new Map<string, number>();
  for (const r of parseCsvObjects(await readFile(SITELINKS, 'utf8'))) {
    const n = Number(r.sitelinks);
    if (r.name && Number.isFinite(n)) notable.set(r.name.trim(), Math.max(n, notable.get(r.name.trim()) ?? 0));
  }

  const mass: Record<string, BuiltCollection['facts']> = {
    'animals-mammal-mass': [],
    'animals-bird-mass': [],
    'animals-reptile-mass': [],
  };
  const longevity: BuiltCollection['facts'] = [];
  const nameUse = new Map<string, number>();

  type Candidate = { id: string; name: string; sci: string; cls: string; mass: number; life: number };
  const candidates: Candidate[] = [];
  for (const r of rows) {
    const cls = r.class ?? '';
    const collection = CLASS_COLLECTION[cls];
    if (!collection) continue;
    if (r.subspecies && r.subspecies !== '-999') continue;
    const sci = `${r.genus} ${r.species}`.trim();
    const common = r.common_name && r.common_name !== '-999' ? cleanCommonName(r.common_name) : '';
    const massG = Number(r.adult_body_mass_g);
    const life = Number(r.maximum_longevity_y);
    const reasonTargets = [collection, 'animals-longevity'];
    if (!common) {
      reasonTargets.forEach((c) => log.add(c, 'no common name', sci));
      continue;
    }
    const minLinks = CLASS_MIN_SITELINKS[cls]!;
    if ((notable.get(sci) ?? 0) < minLinks) {
      reasonTargets.forEach((c) => log.add(c, `fewer than ${minLinks} Wikipedia language editions`, sci));
      continue;
    }
    candidates.push({ id: sci.replace(/\s+/g, '_'), name: common, sci, cls, mass: massG, life });
    nameUse.set(common, (nameUse.get(common) ?? 0) + 1);
  }

  for (const c of candidates) {
    const collection = CLASS_COLLECTION[c.cls]!;
    // Two species sharing one common name would be indistinguishable: skip both.
    if ((nameUse.get(c.name) ?? 0) > 1) {
      log.add(collection, 'common name shared by several species', c.sci);
      continue;
    }
    const base = { entityId: c.id, name: c.name, sourceRecordId: c.sci };
    if (Number.isFinite(c.mass) && c.mass > 0) {
      mass[collection]!.push({ ...base, value: c.mass, context: c.sci });
    } else {
      log.add(collection, 'no adult body mass recorded', c.sci);
    }
    if (Number.isFinite(c.life) && c.life > 0) {
      // Sub-six-month "maximum" lifespans for mammals, birds or reptiles are
      // almost certainly juvenile or captive-death records, not maxima.
      if (c.life > 250 || c.life < 0.5) log.add('animals-longevity', 'outside plausible range', c.sci);
      else longevity.push({ ...base, value: c.life, context: `${CLASS_LABEL[c.cls]} · ${c.sci}` });
    } else {
      log.add('animals-longevity', 'no maximum longevity recorded', c.sci);
    }
  }

  const base = { sourceId: 'amniote-database', periodKey: 'aug-2015', periodLabel: 'Aug 2015 release' };
  return [
    ...Object.entries(mass).map(([collectionId, facts]) => ({ collectionId, ...base, facts })),
    { collectionId: 'animals-longevity', ...base, facts: longevity },
  ];
}
