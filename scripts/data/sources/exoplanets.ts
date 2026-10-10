/**
 * NASA Exoplanet Archive — Planetary Systems Composite Parameters (pscomppars).
 * NASA data are not copyrighted; the archive requests an acknowledgement,
 * which is shown on the Data Sources screen.
 *
 * Quality rules:
 *  - values the archive marks as "Calculated Value" (derived rather than
 *    reported in the literature) are excluded;
 *  - planet mass uses only true masses (pl_bmassprov = "Mass"); minimum
 *    masses (M sin i) and mass–radius estimates are a different quantity;
 *  - distance is a property of the host system, so that collection is keyed
 *    by host star (one row per system) and converted from parsecs to
 *    light-years with the IAU factor.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCsvObjects } from '../lib/csv.ts';
import { download } from '../lib/http.ts';
import type { BuiltCollection, ExclusionLog } from '../lib/types.ts';
import { parsecsToLightYears } from '../../../src/data/units.ts';

const RAW = 'data/raw/exoplanets';
const COLUMNS = [
  'pl_name',
  'hostname',
  'pl_orbper',
  'pl_orbper_reflink',
  'pl_rade',
  'pl_rade_reflink',
  'pl_bmasse',
  'pl_bmasse_reflink',
  'pl_bmassprov',
  'sy_dist',
  'sy_dist_reflink',
  'disc_year',
  'discoverymethod',
];

export async function fetchExoplanets(force = false): Promise<void> {
  const q = `select ${COLUMNS.join(',')} from pscomppars`;
  await download(
    `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(q)}&format=csv`,
    join(RAW, 'pscomppars.csv'),
    { force },
  );
}

const isCalculated = (reflink: string | undefined) => /CALCULATED_VALUE|Calculated Value/i.test(reflink ?? '');
const slug = (s: string) => s.trim().replace(/\s+/g, '_');

export async function buildExoplanets(log: ExclusionLog): Promise<BuiltCollection[]> {
  const rows = parseCsvObjects(await readFile(join(RAW, 'pscomppars.csv'), 'utf8'));
  const period: BuiltCollection['facts'] = [];
  const radius: BuiltCollection['facts'] = [];
  const mass: BuiltCollection['facts'] = [];
  const systems = new Map<string, { value: number; count: number }>();

  for (const r of rows) {
    const name = (r.pl_name ?? '').trim();
    if (!name) continue;
    const id = slug(name);
    const ctx = r.disc_year ? `Discovered ${r.disc_year}` : undefined;
    const num = (k: string) => (r[k] === '' || r[k] === undefined ? NaN : Number(r[k]));

    const p = num('pl_orbper');
    if (!Number.isFinite(p) || p <= 0) log.add('space-exo-period', 'no orbital period', name);
    else if (isCalculated(r.pl_orbper_reflink)) log.add('space-exo-period', 'calculated (not measured) value', name);
    else period.push({ entityId: id, name, value: p, sourceRecordId: name, context: ctx });

    const rad = num('pl_rade');
    if (!Number.isFinite(rad) || rad <= 0) log.add('space-exo-radius', 'no radius', name);
    else if (isCalculated(r.pl_rade_reflink)) log.add('space-exo-radius', 'calculated from mass–radius relation', name);
    else radius.push({ entityId: id, name, value: rad, sourceRecordId: name, context: ctx });

    const m = num('pl_bmasse');
    if (!Number.isFinite(m) || m <= 0) log.add('space-exo-mass', 'no mass', name);
    else if (r.pl_bmassprov !== 'Mass') log.add('space-exo-mass', `mass type is ${r.pl_bmassprov || 'unknown'}, not true mass`, name);
    else if (isCalculated(r.pl_bmasse_reflink)) log.add('space-exo-mass', 'calculated (not measured) value', name);
    else mass.push({ entityId: id, name, value: m, sourceRecordId: name, context: ctx });

    const host = (r.hostname ?? '').trim();
    const d = num('sy_dist');
    if (host && Number.isFinite(d) && d > 0) {
      const s = systems.get(host);
      if (s) s.count++;
      else systems.set(host, { value: d, count: 1 });
    } else if (host) {
      log.add('space-exo-distance', 'no system distance', host);
    }
  }

  const distance: BuiltCollection['facts'] = [...systems.entries()].map(([host, s]) => ({
    entityId: slug(host),
    name: host,
    value: Number(parsecsToLightYears(s.value).toPrecision(8)),
    sourceRecordId: host,
    context: s.count === 1 ? '1 known planet' : `${s.count} known planets`,
  }));

  const base = { sourceId: 'nasa-exoplanet-archive', periodKey: 'current', periodLabel: 'Archive snapshot' };
  return [
    { collectionId: 'space-exo-period', ...base, facts: period },
    { collectionId: 'space-exo-radius', ...base, facts: radius },
    { collectionId: 'space-exo-mass', ...base, facts: mass },
    { collectionId: 'space-exo-distance', ...base, facts: distance },
  ];
}
