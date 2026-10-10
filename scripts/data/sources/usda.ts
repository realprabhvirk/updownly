/**
 * USDA FoodData Central — SR Legacy (April 2018 release), CC0 1.0.
 * Nutrient amounts are per 100 g of the edible portion, so every value in
 * a collection shares the same basis.
 *
 * Exclusions: baby foods, fast-food and restaurant menu items, branded
 * products, quality-control materials, USDA commodity specification codes,
 * names with brand-style capitals, and names over 60 characters (to keep
 * the game readable). Foods with a zero amount of a nutrient are left out
 * of that nutrient's pool: a 0 g reference makes the next answer certain.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseCsvObjects } from '../lib/csv.ts';
import { download, exists } from '../lib/http.ts';
import type { BuiltCollection, ExclusionLog } from '../lib/types.ts';

const RAW = 'data/raw/usda';
const ZIP_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip';
const DIR = join(RAW, 'FoodData_Central_sr_legacy_food_csv_2018-04');

export const USDA_NUTRIENTS: Record<string, { nutrientId: string; max: number }> = {
  'food-energy': { nutrientId: '1008', max: 902 },
  'food-protein': { nutrientId: '1003', max: 100 },
  'food-sugar': { nutrientId: '2000', max: 100 },
  'food-fat': { nutrientId: '1004', max: 100 },
  'food-fibre': { nutrientId: '1079', max: 100 },
};

const EXCLUDED_CATEGORIES = new Map([
  ['3', 'baby foods'],
  ['21', 'fast-food menu item'],
  ['25', 'restaurant menu item'],
  ['26', 'branded product'],
  ['27', 'quality-control material'],
]);

export async function fetchUsda(force = false): Promise<void> {
  const zip = join(RAW, 'sr_legacy.zip');
  await download(ZIP_URL, zip, { force });
  if (force || !(await exists(DIR))) {
    execFileSync('unzip', ['-q', '-o', zip, '-d', RAW]);
  }
}

export function foodNameProblem(name: string): string | null {
  if (name.length > 60) return 'name longer than 60 characters';
  if (/USDA|commodity/i.test(name)) return 'USDA commodity specification item';
  // Brand names in SR Legacy are written in capitals, e.g. "KELLOGG'S".
  if (/\b[A-Z][A-Z'&.]{2,}\b/.test(name.replace(/\bNFS\b|\bNS\b/g, ''))) return 'brand-name product';
  if (/\bformerly\b|\bincludes\b|\(for\b/i.test(name)) return 'name contains editorial qualifier';
  return null;
}

export async function buildUsda(log: ExclusionLog): Promise<BuiltCollection[]> {
  const foods = parseCsvObjects(await readFile(join(DIR, 'food.csv'), 'utf8'));
  const categories = new Map(
    parseCsvObjects(await readFile(join(DIR, 'food_category.csv'), 'utf8')).map((c) => [c.id, c.description]),
  );
  const keep = new Map<string, { name: string; category: string }>();
  for (const f of foods) {
    const name = (f.description ?? '').trim();
    const excluded = EXCLUDED_CATEGORIES.get(f.food_category_id ?? '');
    if (excluded) {
      for (const c of Object.keys(USDA_NUTRIENTS)) log.add(c, excluded, name);
      continue;
    }
    const problem = foodNameProblem(name);
    if (problem) {
      for (const c of Object.keys(USDA_NUTRIENTS)) log.add(c, problem, name);
      continue;
    }
    keep.set(f.fdc_id!, { name, category: categories.get(f.food_category_id ?? '') ?? '' });
  }

  const wanted = new Map(Object.entries(USDA_NUTRIENTS).map(([c, n]) => [n.nutrientId, c]));
  const values = new Map<string, Map<string, number>>(); // collection → fdc → value
  for (const c of Object.keys(USDA_NUTRIENTS)) values.set(c, new Map());

  const text = await readFile(join(DIR, 'food_nutrient.csv'), 'utf8');
  for (const line of text.split('\n').slice(1)) {
    if (!line) continue;
    // Columns: id, fdc_id, nutrient_id, amount, ... (all quoted simple values)
    const cols = line.split('","');
    const fdc = cols[1];
    const nutrient = cols[2];
    const collection = wanted.get(nutrient ?? '');
    if (!collection || !fdc || !keep.has(fdc)) continue;
    const amount = Number(cols[3]);
    if (!Number.isFinite(amount)) continue;
    values.get(collection)!.set(fdc, amount);
  }

  const out: BuiltCollection[] = [];
  for (const [collectionId, { max }] of Object.entries(USDA_NUTRIENTS)) {
    const facts: BuiltCollection['facts'] = [];
    for (const [fdc, food] of keep) {
      const v = values.get(collectionId)!.get(fdc);
      if (v === undefined) {
        log.add(collectionId, 'nutrient not analysed for this food', food.name);
        continue;
      }
      if (v === 0) {
        // A 0 g reference would make the next question trivially "higher".
        log.add(collectionId, 'zero amount (would make questions one-sided)', food.name);
        continue;
      }
      if (v < 0 || v > max) {
        log.add(collectionId, 'outside physical range per 100 g', food.name);
        continue;
      }
      facts.push({ entityId: fdc, name: food.name, value: v, sourceRecordId: fdc, context: food.category });
    }
    out.push({
      collectionId,
      sourceId: 'usda-fdc-sr-legacy',
      periodKey: 'sr-legacy-2018',
      periodLabel: 'SR Legacy (2018)',
      facts,
    });
  }
  return out;
}
