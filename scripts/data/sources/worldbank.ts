/**
 * World Bank World Development Indicators (CC BY 4.0).
 *
 * Each indicator becomes one collection pinned to a single reference year:
 * the most recent year whose country coverage is at least 85 % of the best
 * year since 2010, so pools stay large while staying as current as possible. Regional and income aggregates are excluded using the
 * World Bank country metadata (aggregates have region id "NA").
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { download } from '../lib/http.ts';
import type { BuiltCollection, ExclusionLog } from '../lib/types.ts';

const RAW = 'data/raw/worldbank';
const API = 'https://api.worldbank.org/v2';

export const WB_INDICATORS: Record<string, string> = {
  'world-population': 'SP.POP.TOTL',
  'world-land-area': 'AG.LND.TOTL.K2',
  'world-gdp': 'NY.GDP.MKTP.CD',
  'world-gdp-per-capita': 'NY.GDP.PCAP.CD',
  'world-life-expectancy': 'SP.DYN.LE00.IN',
  'world-co2-per-capita': 'EN.GHG.CO2.PC.CE.AR5',
  'world-internet': 'IT.NET.USER.ZS',
  'world-urban': 'SP.URB.TOTL.IN.ZS',
  'world-renewables': 'EG.FEC.RNEW.ZS',
  'world-forest': 'AG.LND.FRST.ZS',
  'world-fertility': 'SP.DYN.TFRT.IN',
  'world-density': 'EN.POP.DNST',
  'world-over-65': 'SP.POP.65UP.TO.ZS',
};

/**
 * Plain-English display names for World Bank economies whose official
 * names use inverted or abbreviated forms. Identity is still the ISO3 code.
 */
const DISPLAY_NAMES: Record<string, string> = {
  BHS: 'Bahamas',
  COD: 'DR Congo',
  COG: 'Republic of the Congo',
  EGY: 'Egypt',
  FSM: 'Micronesia',
  GMB: 'Gambia',
  HKG: 'Hong Kong',
  IRN: 'Iran',
  KGZ: 'Kyrgyzstan',
  KNA: 'St Kitts and Nevis',
  KOR: 'South Korea',
  PRK: 'North Korea',
  LAO: 'Laos',
  LCA: 'St Lucia',
  MAC: 'Macao',
  MAF: 'Saint Martin (French part)',
  PSE: 'Palestine',
  RUS: 'Russia',
  SVK: 'Slovakia',
  SYR: 'Syria',
  TUR: 'Türkiye',
  VCT: 'St Vincent and the Grenadines',
  VEN: 'Venezuela',
  VIR: 'US Virgin Islands',
  VNM: 'Vietnam',
  YEM: 'Yemen',
  CZE: 'Czechia',
  BRN: 'Brunei',
  CPV: 'Cabo Verde',
  SXM: 'Sint Maarten',
  NRU: 'Nauru',
  SOM: 'Somalia',
  PRI: 'Puerto Rico',
};

/** Indicators where an exact zero signals a reporting gap, not a real value. */
const ZERO_IS_GAP = new Set(['EN.GHG.CO2.PC.CE.AR5', 'SP.DYN.LE00.IN', 'SP.POP.TOTL', 'AG.LND.TOTL.K2']);

type WbRow = {
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
};

export async function fetchWorldBank(force = false): Promise<void> {
  await download(`${API}/country?format=json&per_page=400`, join(RAW, 'countries.json'), { force });
  for (const indicator of Object.values(WB_INDICATORS)) {
    await download(
      `${API}/country/all/indicator/${indicator}?format=json&per_page=20000&date=2010:2026`,
      join(RAW, `${indicator}.json`),
      { force },
    );
  }
}

export async function buildWorldBank(log: ExclusionLog): Promise<BuiltCollection[]> {
  const countriesJson = JSON.parse(await readFile(join(RAW, 'countries.json'), 'utf8')) as [
    unknown,
    Array<{ id: string; iso2Code: string; name: string; region: { id: string; value: string } }>,
  ];
  const countries = new Map(
    countriesJson[1]
      .filter((c) => c.region.id !== 'NA' && c.region.id !== '')
      .map((c) => [c.id, { iso2: c.iso2Code, name: DISPLAY_NAMES[c.id] ?? c.name.trim(), region: c.region.value.trim() }]),
  );

  const out: BuiltCollection[] = [];
  for (const [collectionId, indicator] of Object.entries(WB_INDICATORS)) {
    const json = JSON.parse(await readFile(join(RAW, `${indicator}.json`), 'utf8')) as [unknown, WbRow[]];
    const rows = json[1].filter((r) => countries.has(r.countryiso3code));
    const coverage = new Map<string, number>();
    for (const r of rows) {
      if (r.value !== null && Number.isFinite(r.value)) coverage.set(r.date, (coverage.get(r.date) ?? 0) + 1);
    }
    const best = Math.max(...coverage.values());
    const year = [...coverage.entries()]
      .filter(([, n]) => n >= best * 0.85)
      .map(([y]) => y)
      .sort()
      .at(-1);
    if (!year) throw new Error(`No usable year for ${indicator}`);

    const facts: BuiltCollection['facts'] = [];
    for (const r of rows) {
      if (r.date !== year) continue;
      const c = countries.get(r.countryiso3code)!;
      if (r.value === null || !Number.isFinite(r.value)) {
        log.add(collectionId, `no ${year} value published`, c.name);
        continue;
      }
      if (r.value < 0) {
        log.add(collectionId, 'negative value', c.name);
        continue;
      }
      // EDGAR reports near-zero per-capita CO₂ for some territories whose
      // emissions are booked to another country; those are gaps too.
      if (indicator === 'EN.GHG.CO2.PC.CE.AR5' && r.value < 0.01) {
        log.add(collectionId, 'below 0.01 t per person (emissions reported elsewhere)', c.name);
        continue;
      }
      if (r.value === 0 && ZERO_IS_GAP.has(indicator)) {
        log.add(collectionId, 'zero value (reporting gap, not a real measurement)', c.name);
        continue;
      }
      facts.push({
        entityId: r.countryiso3code,
        name: c.name,
        value: r.value,
        sourceRecordId: c.iso2,
        context: c.region,
      });
    }
    out.push({
      collectionId,
      sourceId: 'worldbank-wdi',
      periodKey: year,
      periodLabel: year,
      facts,
    });
  }
  return out;
}
