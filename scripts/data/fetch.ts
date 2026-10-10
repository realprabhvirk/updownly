/**
 * `npm run data:fetch` — downloads raw source files into data/raw/.
 * This is the only step that needs a network connection; it is never run
 * by the app or by `npm run build`. Pass --force to re-download everything,
 * or --only=<source> to refresh one source.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchAmniote } from './sources/amniote.ts';
import { fetchExoplanets } from './sources/exoplanets.ts';
import { fetchOurAirports } from './sources/ourairports.ts';
import { fetchPubchem } from './sources/pubchem.ts';
import { fetchUsda } from './sources/usda.ts';
import { fetchWikidata } from './sources/wikidata.ts';
import { fetchWorldBank } from './sources/worldbank.ts';

const FETCHERS: Record<string, (force: boolean) => Promise<void>> = {
  'worldbank-wdi': fetchWorldBank,
  'nasa-exoplanet-archive': fetchExoplanets,
  ourairports: fetchOurAirports,
  'usda-fdc-sr-legacy': fetchUsda,
  'pubchem-periodic-table': fetchPubchem,
  'amniote-database': fetchAmniote,
  wikidata: fetchWikidata,
};

const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

await mkdir('data/raw', { recursive: true });
for (const [id, fetcher] of Object.entries(FETCHERS)) {
  if (only && only !== id) continue;
  console.log(`▸ ${id}`);
  await fetcher(force);
  await writeFile(join('data/raw', `${id}.retrieved`), new Date().toISOString().slice(0, 10));
}
console.log('Raw data ready in data/raw/. Next: npm run data:build');
