/**
 * OurAirports (public domain). Large and medium airports with scheduled
 * passenger service only, which keeps the pools to airports people fly to. Elevation and runway
 * length are published in feet and converted to metres with the exact
 * international foot (0.3048 m).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCsvObjects } from '../lib/csv.ts';
import { download } from '../lib/http.ts';
import type { BuiltCollection, ExclusionLog } from '../lib/types.ts';
import { feetToMetres } from '../../../src/data/units.ts';

const RAW = 'data/raw/ourairports';
const BASE = 'https://davidmegginson.github.io/ourairports-data';

export async function fetchOurAirports(force = false): Promise<void> {
  for (const f of ['airports.csv', 'runways.csv', 'countries.csv']) {
    await download(`${BASE}/${f}`, join(RAW, f), { force });
  }
}

export async function buildOurAirports(log: ExclusionLog): Promise<BuiltCollection[]> {
  const airports = parseCsvObjects(await readFile(join(RAW, 'airports.csv'), 'utf8'));
  const runways = parseCsvObjects(await readFile(join(RAW, 'runways.csv'), 'utf8'));
  const countries = new Map(
    parseCsvObjects(await readFile(join(RAW, 'countries.csv'), 'utf8')).map((c) => [c.code, c.name]),
  );

  const selected = airports.filter(
    (a) => (a.type === 'large_airport' || a.type === 'medium_airport') && a.scheduled_service === 'yes',
  );
  const byRef = new Map(selected.map((a) => [a.id, a]));

  const longest = new Map<string, number>();
  for (const r of runways) {
    if (!byRef.has(r.airport_ref ?? '')) continue;
    if (r.closed === '1') continue;
    const len = Number(r.length_ft);
    if (!Number.isFinite(len) || len <= 0 || r.length_ft === '') continue;
    longest.set(r.airport_ref!, Math.max(longest.get(r.airport_ref!) ?? 0, len));
  }

  const elevation: BuiltCollection['facts'] = [];
  const runway: BuiltCollection['facts'] = [];
  const nameCount = new Map<string, number>();
  for (const a of selected) nameCount.set(a.name!, (nameCount.get(a.name!) ?? 0) + 1);

  for (const a of selected) {
    const name = (a.name ?? '').trim();
    const code = a.iata_code || a.icao_code || a.ident;
    const country = countries.get(a.iso_country ?? '') ?? a.iso_country;
    const place = [a.municipality, country].filter(Boolean).join(', ');
    const context = code ? `${code} · ${place}` : place;
    if (!name) continue;
    const id = a.ident!;
    if (a.elevation_ft === '' || !Number.isFinite(Number(a.elevation_ft))) {
      log.add('transport-airport-elevation', 'no published elevation', name);
    } else {
      const m = feetToMetres(Number(a.elevation_ft));
      if (m < -450 || m > 4500) log.add('transport-airport-elevation', 'outside plausible range', name);
      else elevation.push({ entityId: id, name, value: Number(m.toFixed(2)), sourceRecordId: a.ident, context });
    }
    const len = longest.get(a.id!);
    if (len === undefined) {
      log.add('transport-runway-length', 'no open runway with a published length', name);
    } else {
      const m = feetToMetres(len);
      if (m < 300 || m > 6000) log.add('transport-runway-length', 'outside plausible range', name);
      else runway.push({ entityId: id, name, value: Number(m.toFixed(2)), sourceRecordId: a.ident, context });
    }
  }

  const base = { sourceId: 'ourairports', periodKey: 'current', periodLabel: 'Current record' };
  return [
    { collectionId: 'transport-airport-elevation', ...base, facts: elevation },
    { collectionId: 'transport-runway-length', ...base, facts: runway },
  ];
}
