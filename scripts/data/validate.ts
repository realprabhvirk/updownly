/**
 * `npm run data:validate` — validates the bundled dataset. Runs before
 * every production build; any error fails the build.
 */
import { ALLOWED_LICENCES, COLLECTIONS, METRICS, SOURCES } from '../../src/data/definitions.ts';
import { validateDataset } from '../../src/data/validate.ts';
import { loadGenerated } from './lib/load-generated.ts';

const { manifest, files } = await loadGenerated();
const result = validateDataset({
  manifest,
  files,
  collections: COLLECTIONS,
  metrics: METRICS,
  sources: SOURCES,
  allowedLicences: ALLOWED_LICENCES,
});

const verbose = process.argv.includes('--verbose');
if (result.warnings.length) {
  console.log(`${result.warnings.length} warning(s)${verbose ? ':' : ' (run with --verbose to list)'}`);
  if (verbose) for (const w of result.warnings) console.log(`  ⚠ ${w}`);
}
for (const e of result.errors.slice(0, 50)) console.error(`  ✗ ${e}`);
const s = result.stats;
console.log(
  `${s.totalFacts.toLocaleString('en')} facts · ${s.totalEntities.toLocaleString('en')} entities · ${s.collections} collections · ${s.groups} groups`,
);
if (result.errors.length) {
  console.error(`Data validation failed with ${result.errors.length} error(s).`);
  process.exit(1);
}
console.log('Data validation passed.');
