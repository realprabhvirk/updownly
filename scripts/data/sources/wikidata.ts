/**
 * Wikidata (CC0) collections: physical geography, structures, venues, films.
 *
 * Quality rules applied in `build`:
 *  - entity must have an English label and an English Wikipedia article;
 *  - deprecated statements are ignored;
 *  - statements qualified with "applies to part" (P518) are ignored, so a
 *    river's "main stem" or a stadium's "seated" figure never mixes in;
 *  - a preferred-rank statement wins; otherwise all remaining statements
 *    must agree within 0.5 % after unit conversion, or the entity is
 *    excluded as ambiguous (and counted in the exclusion log);
 *  - every unit is converted with an explicit, tested factor.
 */
import { join } from 'node:path';
import { parseCsvObjects } from '../lib/csv.ts';
import { exists } from '../lib/http.ts';
import { sparqlCsv } from '../lib/sparql.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { BuiltCollection, ExclusionLog } from '../lib/types.ts';
import { convertWikidataUnit } from '../../../src/data/units.ts';

const RAW = 'data/raw/wikidata';

type Spec = {
  collectionId: string;
  types: string[];
  prop: string;
  /** Canonical target unit for the collection: 'm', 'km', 'km2', 'min', 'count'. */
  unit: 'm' | 'km' | 'km2' | 'min' | 'count';
  min: number;
  max?: number;
  minSitelinks?: number;
  /** Context column: country labels (default) or release year. */
  context?: 'countries' | 'year';
  excludeEnded?: boolean;
  /** Exclude entities with any of these property values (e.g. P31 paleolake). */
  exclude?: Array<[prop: string, values: string[]]>;
  /** Require evidence the structure exists: opening date or "in use" state. */
  requireCompleted?: boolean;
};

const UNBUILT: [string, string[]] = ['P31', ['Q1570262', 'Q811683', 'Q12377751', 'Q15401884']];

export const WIKIDATA_SPECS: Spec[] = [
  {
    collectionId: 'geo-mountains',
    types: ['Q8502', 'Q8072', 'Q169358', 'Q207326'],
    prop: 'P2044',
    unit: 'm',
    min: 1000,
    max: 8900,
    minSitelinks: 10,
  },
  { collectionId: 'geo-rivers', types: ['Q4022'], prop: 'P2043', unit: 'km', min: 100, max: 7000, minSitelinks: 12 },
  {
    collectionId: 'geo-lakes',
    types: ['Q23397', 'Q188025', 'Q204324'],
    prop: 'P2046',
    unit: 'km2',
    min: 1,
    max: 400_000,
    minSitelinks: 5,
    // Prehistoric lakes (e.g. Lake Tauca) are not lakes you can visit today.
    exclude: [['P31', ['Q55965244', 'Q1640628', 'Q2087356']]],
  },
  { collectionId: 'geo-islands', types: ['Q23442'], prop: 'P2046', unit: 'km2', min: 1, max: 2_200_000, minSitelinks: 8 },
  { collectionId: 'geo-waterfalls', types: ['Q34038'], prop: 'P2048', unit: 'm', min: 5, max: 1000 },
  {
    collectionId: 'buildings-skyscraper-height',
    types: ['Q11303'],
    prop: 'P2048',
    unit: 'm',
    min: 100,
    max: 900,
    excludeEnded: true,
    exclude: [UNBUILT],
    requireCompleted: true,
  },
  {
    collectionId: 'buildings-skyscraper-floors',
    types: ['Q11303'],
    prop: 'P1101',
    unit: 'count',
    min: 10,
    max: 200,
    minSitelinks: 3,
    excludeEnded: true,
    exclude: [UNBUILT],
    requireCompleted: true,
  },
  { collectionId: 'buildings-dams', types: ['Q12323'], prop: 'P2048', unit: 'm', min: 15, max: 320, minSitelinks: 3, excludeEnded: true },
  {
    collectionId: 'transport-bridges',
    types: ['Q12280', 'Q12570', 'Q158218', 'Q537127', 'Q158438', 'Q1068842', 'Q1825472'],
    prop: 'P2787',
    unit: 'm',
    min: 20,
    max: 2100,
    excludeEnded: true,
  },
  {
    collectionId: 'transport-tunnels',
    types: ['Q44377', 'Q1311958', 'Q2354973'],
    prop: 'P2043',
    unit: 'km',
    min: 0.5,
    max: 60,
    excludeEnded: true,
  },
  {
    collectionId: 'culture-stadiums',
    types: ['Q483110', 'Q1154710', 'Q641226'],
    prop: 'P1083',
    unit: 'count',
    min: 5000,
    max: 160_000,
    minSitelinks: 5,
    excludeEnded: true,
  },
  {
    collectionId: 'culture-films',
    types: ['Q11424'],
    prop: 'P2047',
    unit: 'min',
    min: 40,
    max: 300,
    minSitelinks: 40,
    context: 'year',
    // Keep the game family-friendly: no pornographic films.
    exclude: [['P136', ['Q185529']]],
  },
];

function buildQuery(spec: Spec): string {
  const contextSelect =
    spec.context === 'year'
      ? '(MIN(YEAR(?pub)) AS ?ctx)'
      : '(GROUP_CONCAT(DISTINCT ?cl; separator="|") AS ?ctx)';
  const contextPattern =
    spec.context === 'year'
      ? 'OPTIONAL { ?item wdt:P577 ?pub . }'
      : 'OPTIONAL { ?item wdt:P17 ?c . ?c rdfs:label ?cl . FILTER(LANG(?cl) = "en") }';
  const excludePatterns = (spec.exclude ?? [])
    .map(
      ([prop, values], i) =>
        `OPTIONAL { ?item wdt:${prop} ?bad${i} . VALUES ?bad${i} { ${values.map((v) => `wd:${v}`).join(' ')} } }`,
    )
    .join('\n  ');
  const excludeSelect = (spec.exclude ?? []).map((_, i) => `(SAMPLE(?bad${i}) AS ?excluded${i})`).join(' ');
  const completedPattern = spec.requireCompleted
    ? 'OPTIONAL { ?item wdt:P1619 ?opened . } OPTIONAL { ?item wdt:P5817 ?use . }'
    : '';
  const completedSelect = spec.requireCompleted ? '(SAMPLE(?opened) AS ?openedAt) (GROUP_CONCAT(DISTINCT ?use; separator="|") AS ?uses)' : '';
  return `SELECT ?item ?itemLabel ?val ?unit ?rank ?part ?sitelinks ${contextSelect} (SAMPLE(?end) AS ?ended) ${excludeSelect} ${completedSelect} WHERE {
  VALUES ?type { ${spec.types.map((t) => `wd:${t}`).join(' ')} }
  ?item wdt:P31 ?type .
  ?item p:${spec.prop} ?st .
  ?st wikibase:rank ?rank .
  ?st psv:${spec.prop} ?v .
  ?v wikibase:quantityAmount ?val ; wikibase:quantityUnit ?unit .
  OPTIONAL { ?st pq:P518 ?part . }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  ?item wikibase:sitelinks ?sitelinks .
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
  ${contextPattern}
  OPTIONAL { ?item wdt:P576 ?end . }
  ${excludePatterns}
  ${completedPattern}
} GROUP BY ?item ?itemLabel ?val ?unit ?rank ?part ?sitelinks`;
}

export async function fetchWikidata(force = false): Promise<void> {
  await mkdir(RAW, { recursive: true });
  for (const spec of WIKIDATA_SPECS) {
    const path = join(RAW, `${spec.collectionId}.csv`);
    if (!force && (await exists(path))) {
      console.log(`  = ${path} (cached)`);
      continue;
    }
    console.log(`  ↓ Wikidata ${spec.collectionId}`);
    const csv = await sparqlCsv(buildQuery(spec));
    await writeFile(path, csv);
    await writeFile(join(RAW, `${spec.collectionId}.rq`), buildQuery(spec));
  }
}

const qid = (uri: string) => uri.replace('http://www.wikidata.org/entity/', '');

/** Reduce raw statement rows to one value per entity, or null if ambiguous. */
export function resolveStatements(
  statements: Array<{ value: number; rank: string }>,
  tolerance = 0.005,
): number | null {
  const live = statements.filter((s) => !s.rank.endsWith('DeprecatedRank'));
  if (live.length === 0) return null;
  const preferred = live.filter((s) => s.rank.endsWith('PreferredRank'));
  const pool = preferred.length > 0 ? preferred : live;
  const values = [...new Set(pool.map((s) => s.value))];
  if (values.length === 1) return values[0]!;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo <= 0) return null;
  if ((hi - lo) / lo > tolerance) return null;
  // All within tolerance: use the median value.
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export async function buildWikidata(log: ExclusionLog): Promise<BuiltCollection[]> {
  const out: BuiltCollection[] = [];
  for (const spec of WIKIDATA_SPECS) {
    const path = join(RAW, `${spec.collectionId}.csv`);
    const rows = parseCsvObjects(await readFile(path, 'utf8'));
    const byItem = new Map<
      string,
      {
        label: string;
        sitelinks: number;
        ctx: string;
        ended: boolean;
        excluded: boolean;
        completed: boolean;
        statements: Array<{ value: number; rank: string }>;
        badUnit: boolean;
      }
    >();
    for (const r of rows) {
      const id = qid(r.item ?? '');
      if (!/^Q\d+$/.test(id)) continue;
      let entry = byItem.get(id);
      if (!entry) {
        entry = {
          label: (r.itemLabel ?? '').trim(),
          sitelinks: Number(r.sitelinks),
          ctx: r.ctx ?? '',
          ended: Boolean(r.ended),
          excluded: Object.keys(r).some((k) => k.startsWith('excluded') && Boolean(r[k])),
          // "in use" (Q55654238) or an official opening date counts as built.
          completed: Boolean(r.openedAt) || (r.uses ?? '').includes('Q55654238'),
          statements: [],
          badUnit: false,
        };
        byItem.set(id, entry);
      }
      if (r.part) continue; // applies only to part of the entity
      const converted = convertWikidataUnit(Number(r.val), qid(r.unit ?? ''), spec.unit);
      if (converted === null) {
        if (!(r.rank ?? '').endsWith('DeprecatedRank')) entry.badUnit = true;
        continue;
      }
      entry.statements.push({ value: converted, rank: r.rank ?? '' });
    }

    const facts: BuiltCollection['facts'] = [];
    for (const [id, e] of byItem) {
      const reject = (reason: string) => log.add(spec.collectionId, reason, `${id} ${e.label}`);
      if (!e.label || /^Q\d+$/.test(e.label)) {
        reject('missing English label');
        continue;
      }
      if (spec.minSitelinks && e.sitelinks < spec.minSitelinks) {
        reject(`fewer than ${spec.minSitelinks} Wikipedia sitelinks`);
        continue;
      }
      if (spec.excludeEnded && e.ended) {
        reject('demolished or dissolved');
        continue;
      }
      if (e.excluded) {
        reject('excluded type (unbuilt, prehistoric or adult content)');
        continue;
      }
      if (spec.requireCompleted && !e.completed) {
        reject('no evidence of completion (opening date or in-use state)');
        continue;
      }
      if (e.statements.length === 0) {
        reject(e.badUnit ? 'unsupported unit' : 'no usable whole-entity statement');
        continue;
      }
      const value = resolveStatements(e.statements);
      if (value === null) {
        reject('conflicting statements');
        continue;
      }
      if (!Number.isFinite(value) || value < spec.min || (spec.max !== undefined && value > spec.max)) {
        reject('outside plausible range for collection');
        continue;
      }
      const ctx =
        spec.context === 'year'
          ? e.ctx && /^\d{4}$/.test(e.ctx)
            ? e.ctx
            : undefined
          : formatCountries(e.ctx);
      facts.push({ entityId: id, name: e.label, value: roundCanonical(value, spec.unit), sourceRecordId: id, context: ctx });
    }
    out.push({
      collectionId: spec.collectionId,
      sourceId: 'wikidata',
      periodKey: 'current',
      periodLabel: 'Current Wikidata record',
      facts,
    });
  }
  return out;
}

/** Common short forms for Wikidata's formal country labels (display only). */
const SHORT_COUNTRY: Record<string, string> = {
  "People's Republic of China": 'China',
  'United States of America': 'United States',
  'Kingdom of the Netherlands': 'Netherlands',
  'Kingdom of Denmark': 'Denmark',
  'Republic of the Congo': 'Congo',
  'Democratic Republic of the Congo': 'DR Congo',
  'Federated States of Micronesia': 'Micronesia',
  "Democratic People's Republic of Korea": 'North Korea',
  'State of Palestine': 'Palestine',
};

function formatCountries(ctx: string): string | undefined {
  if (!ctx) return undefined;
  const parts = [...new Set(ctx.split('|').filter(Boolean).map((p) => SHORT_COUNTRY[p] ?? p))].sort();
  if (parts.length === 0) return undefined;
  if (parts.length > 3) return `${parts.slice(0, 2).join(', ')} +${parts.length - 2}`;
  return parts.join(', ');
}

function roundCanonical(value: number, unit: Spec['unit']): number {
  switch (unit) {
    case 'count':
      return Math.round(value);
    case 'min':
      return Math.round(value * 10) / 10;
    default:
      // Keep 4 significant decimals of precision beyond display needs.
      return Number(value.toPrecision(8));
  }
}
