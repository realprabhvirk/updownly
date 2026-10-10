import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CollectionFile, DataManifest } from '../../../src/data/schema.ts';

export const GENERATED = 'src/data/generated';

export async function loadGenerated(): Promise<{ manifest: DataManifest; files: CollectionFile[] }> {
  const manifest = JSON.parse(await readFile(join(GENERATED, 'manifest.json'), 'utf8')) as DataManifest;
  const names = (await readdir(join(GENERATED, 'facts'))).filter((n) => n.endsWith('.json')).sort();
  const files = await Promise.all(
    names.map(async (n) => JSON.parse(await readFile(join(GENERATED, 'facts', n), 'utf8')) as CollectionFile),
  );
  return { manifest, files };
}
