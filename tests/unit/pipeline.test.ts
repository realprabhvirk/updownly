import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvObjects } from '../../scripts/data/lib/csv';
import { cleanCommonName } from '../../scripts/data/sources/amniote';
import { foodNameProblem } from '../../scripts/data/sources/usda';
import { resolveStatements } from '../../scripts/data/sources/wikidata';

const P = 'http://wikiba.se/ontology#PreferredRank';
const N = 'http://wikiba.se/ontology#NormalRank';
const D = 'http://wikiba.se/ontology#DeprecatedRank';

describe('Wikidata statement resolution', () => {
  it('prefers a preferred-rank value', () => {
    expect(resolveStatements([{ value: 829.8, rank: N }, { value: 828, rank: P }, { value: 584.5, rank: N }])).toBe(828);
  });
  it('ignores deprecated statements', () => {
    expect(resolveStatements([{ value: 8848.86, rank: N }, { value: 8850, rank: D }])).toBe(8848.86);
  });
  it('excludes conflicting unranked values', () => {
    expect(resolveStatements([{ value: 453, rank: N }, { value: 381, rank: N }])).toBeNull();
  });
  it('accepts near-identical values', () => {
    expect(resolveStatements([{ value: 1000, rank: N }, { value: 1002, rank: N }, { value: 1001, rank: N }])).toBe(1001);
  });
  it('returns null when nothing usable remains', () => {
    expect(resolveStatements([{ value: 5, rank: D }])).toBeNull();
    expect(resolveStatements([])).toBeNull();
  });
});

describe('source-specific cleaning', () => {
  it('cleans animal common names', () => {
    expect(cleanCommonName('pied goshawk')).toBe('Pied Goshawk');
    expect(cleanCommonName('Boa Constrictor, Red-tailed Boa')).toBe('Boa Constrictor');
    expect(cleanCommonName('Sidewinder (cerastes: Mojave Desert Sidewinder; X: Y)')).toBe('Sidewinder');
    expect(cleanCommonName('Scutulatus: Mojave Rattlesnake; Salvini: Huamantlan Rattlesnake')).toBe('');
  });

  it('flags brand and commodity food names', () => {
    expect(foodNameProblem('Cheese, cheddar')).toBeNull();
    expect(foodNameProblem("Cereals ready-to-eat, KELLOGG'S CORN FLAKES")).toBe('brand-name product');
    expect(foodNameProblem('Beef, USDA Commodity, ground')).toBe('USDA commodity specification item');
    expect(foodNameProblem('x'.repeat(61))).toBe('name longer than 60 characters');
  });

  it('parses quoted CSV', () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,2,3\n')).toEqual([
      ['a', 'b,c', 'd "e"'],
      ['1', '2', '3'],
    ]);
    expect(parseCsvObjects('x,y\n1,2\n')).toEqual([{ x: '1', y: '2' }]);
  });
});
