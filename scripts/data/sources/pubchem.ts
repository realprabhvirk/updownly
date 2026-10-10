/**
 * PubChem periodic table (National Library of Medicine). Physical
 * properties are compared only where conditions are consistent:
 *  - melting and boiling points are at standard pressure (1 atm), so
 *    helium (no solid at 1 atm), carbon and arsenic (sublime at 1 atm) are
 *    excluded from those pools;
 *  - density is compared only between elements that are solid at standard
 *    conditions (gas densities use different reference conditions);
 *  - elements heavier than einsteinium (Z > 99) have only predicted
 *    physical properties and are excluded from the physical pools.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { download } from '../lib/http.ts';
import type { BuiltCollection, ExclusionLog } from '../lib/types.ts';
import { kelvinToCelsius } from '../../../src/data/units.ts';

const RAW = 'data/raw/pubchem';

export async function fetchPubchem(force = false): Promise<void> {
  await download('https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON', join(RAW, 'periodictable.json'), {
    force,
  });
}

const SUBLIMES_OR_PRESSURE = new Set(['He', 'C', 'As']);

export async function buildPubchem(log: ExclusionLog): Promise<BuiltCollection[]> {
  const json = JSON.parse(await readFile(join(RAW, 'periodictable.json'), 'utf8')) as {
    Table: { Columns: { Column: string[] }; Row: Array<{ Cell: string[] }> };
  };
  const cols = json.Table.Columns.Column;
  const elements = json.Table.Row.map((r) => Object.fromEntries(cols.map((c, i) => [c, r.Cell[i] ?? ''])));

  const atomicNumber: BuiltCollection['facts'] = [];
  const atomicMass: BuiltCollection['facts'] = [];
  const melting: BuiltCollection['facts'] = [];
  const boiling: BuiltCollection['facts'] = [];
  const density: BuiltCollection['facts'] = [];

  for (const e of elements) {
    const z = Number(e.AtomicNumber);
    const name = e.Name!;
    const id = e.Symbol!;
    const ctx = `${e.Symbol} · ${e.GroupBlock}`;
    const base = { entityId: id, name, sourceRecordId: String(z), context: ctx };
    atomicNumber.push({ ...base, value: z });
    const mass = Number(e.AtomicMass);
    if (Number.isFinite(mass) && mass > 0) atomicMass.push({ ...base, value: mass });

    const physical = z <= 99 && ['Solid', 'Liquid', 'Gas'].includes(e.StandardState ?? '');
    const add = (
      list: BuiltCollection['facts'],
      collection: string,
      raw: string | undefined,
      extra?: string,
      convert: (v: number) => number = (v) => v,
    ) => {
      if (!physical) return log.add(collection, 'only predicted values (synthetic element)', name);
      if (extra) return log.add(collection, extra, name);
      if (!raw) return log.add(collection, 'no published value', name);
      const v = Number(raw);
      if (!Number.isFinite(v) || v <= 0) return log.add(collection, 'invalid value (kelvin must be positive)', name);
      list.push({ ...base, value: Number(convert(v).toFixed(2)) });
    };
    const pressureNote = SUBLIMES_OR_PRESSURE.has(id) ? 'no phase change at 1 atm (sublimes or needs pressure)' : undefined;
    // Published in kelvin; converted to Celsius (exact offset).
    add(melting, 'science-melting-point', e.MeltingPoint, pressureNote, kelvinToCelsius);
    add(boiling, 'science-boiling-point', e.BoilingPoint, pressureNote, kelvinToCelsius);
    add(density, 'science-density', e.Density, e.StandardState === 'Solid' ? undefined : 'not solid at standard conditions');
  }

  const base = { sourceId: 'pubchem-periodic-table', periodKey: 'current', periodLabel: 'Standard reference values' };
  return [
    { collectionId: 'science-atomic-number', ...base, facts: atomicNumber },
    { collectionId: 'science-atomic-mass', ...base, facts: atomicMass },
    { collectionId: 'science-melting-point', ...base, facts: melting },
    { collectionId: 'science-boiling-point', ...base, facts: boiling },
    { collectionId: 'science-density', ...base, facts: density },
  ];
}
