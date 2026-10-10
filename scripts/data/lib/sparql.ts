/**
 * Runs SPARQL against Wikidata. Large queries go to the QLever mirror of
 * Wikidata (University of Freiburg), which answers them in seconds; the
 * official Wikidata Query Service is the fallback. Both serve the same CC0
 * Wikidata content.
 */
import { fetchWithRetry, sleep } from './http.ts';

const ENDPOINTS = ['https://qlever.dev/api/wikidata', 'https://query.wikidata.org/sparql'];

export const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
`;

let lastCall = 0;

export async function sparqlCsv(query: string): Promise<string> {
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    // Be polite: public endpoints rate-limit aggressively.
    const wait = 12_000 - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const url = `${endpoint}?query=${encodeURIComponent(PREFIXES + query)}`;
      const buf = await fetchWithRetry(url, {
        headers: { Accept: 'text/csv' },
        rejectBody: /^\s*(<html|<!DOCTYPE|\{\s*"exception")/i,
        retries: 5,
        timeoutMs: 240_000,
      });
      const text = buf.toString('utf8');
      if (!text.includes(',')) throw new Error('Empty SPARQL response');
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`  ! ${endpoint} failed: ${(err as Error).message}`);
    }
  }
  throw lastError;
}
