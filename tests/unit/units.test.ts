import { describe, expect, it } from 'vitest';
import {
  FEET_TO_METRES,
  PARSECS_TO_LIGHT_YEARS,
  convertWikidataUnit,
  feetToMetres,
  kelvinToCelsius,
  parsecsToLightYears,
} from '../../src/data/units';

describe('unit conversions', () => {
  it('uses the exact international foot', () => {
    expect(FEET_TO_METRES).toBe(0.3048);
    expect(feetToMetres(29_032)).toBeCloseTo(8848.95, 2);
    expect(feetToMetres(0)).toBe(0);
    expect(feetToMetres(-70)).toBeCloseTo(-21.336, 6);
  });

  it('converts parsecs to light-years with the IAU factor', () => {
    expect(PARSECS_TO_LIGHT_YEARS).toBeCloseTo(3.26156, 5);
    // Proxima Centauri: 1.3012 pc ≈ 4.244 ly
    expect(parsecsToLightYears(1.3012)).toBeCloseTo(4.244, 3);
  });

  it('converts kelvin to Celsius exactly', () => {
    expect(kelvinToCelsius(273.15)).toBe(0);
    expect(kelvinToCelsius(234.32)).toBeCloseTo(-38.83, 6);
  });

  it('converts Wikidata units only into compatible targets', () => {
    expect(convertWikidataUnit(1, 'Q828224', 'm')).toBe(1000); // km → m
    expect(convertWikidataUnit(1000, 'Q3710', 'm')).toBeCloseTo(304.8, 6); // ft → m
    expect(convertWikidataUnit(1, 'Q253276', 'km')).toBeCloseTo(1.609344, 9); // mi → km
    expect(convertWikidataUnit(1, 'Q232291', 'km2')).toBeCloseTo(2.589988, 6); // sq mi → km²
    expect(convertWikidataUnit(100, 'Q35852', 'km2')).toBeCloseTo(1, 9); // ha → km²
    expect(convertWikidataUnit(2, 'Q25235', 'min')).toBe(120); // h → min
    expect(convertWikidataUnit(5, 'Q11573', 'km2')).toBeNull(); // m is not an area
    expect(convertWikidataUnit(5, 'Q999999', 'm')).toBeNull(); // unknown unit
    expect(convertWikidataUnit(Number.NaN, 'Q11573', 'm')).toBeNull();
  });
});
