/**
 * Explicit unit conversions used by the data pipeline. Every factor here is
 * exact by definition (international yard and pound agreement, SI) or a
 * fixed astronomical constant, and each is covered by unit tests.
 */

export const FEET_TO_METRES = 0.3048;
export const MILES_TO_METRES = 1609.344;
export const SQ_MILES_TO_SQ_KM = 2.589988110336;
export const ACRES_TO_SQ_KM = 0.0040468564224;
export const HECTARES_TO_SQ_KM = 0.01;
/** IAU 2015: 1 pc = 648000/π au; 1 ly = 63241.077 au → 3.261563777 ly. */
export const PARSECS_TO_LIGHT_YEARS = 3.261563777;

export const feetToMetres = (ft: number): number => ft * FEET_TO_METRES;
export const parsecsToLightYears = (pc: number): number => pc * PARSECS_TO_LIGHT_YEARS;
export const kelvinToCelsius = (k: number): number => k - 273.15;

type Target = 'm' | 'km' | 'km2' | 'min' | 'count';

/** Factor to convert one Wikidata unit item into the target unit, or null. */
const WIKIDATA_UNITS: Record<string, Partial<Record<Target, number>>> = {
  Q11573: { m: 1, km: 0.001 }, // metre
  Q828224: { m: 1000, km: 1 }, // kilometre
  Q174728: { m: 0.01, km: 0.00001 }, // centimetre
  Q3710: { m: FEET_TO_METRES, km: FEET_TO_METRES / 1000 }, // foot
  Q253276: { m: MILES_TO_METRES, km: MILES_TO_METRES / 1000 }, // mile
  Q482798: { m: 0.9144, km: 0.0009144 }, // yard
  Q712226: { km2: 1 }, // square kilometre
  Q25343: { km2: 1e-6 }, // square metre
  Q232291: { km2: SQ_MILES_TO_SQ_KM }, // square mile
  Q81292: { km2: ACRES_TO_SQ_KM }, // acre
  Q35852: { km2: HECTARES_TO_SQ_KM }, // hectare
  Q7727: { min: 1 }, // minute
  Q11574: { min: 1 / 60 }, // second
  Q25235: { min: 60 }, // hour
  Q199: { count: 1 }, // dimensionless "1"
};

export function convertWikidataUnit(value: number, unitQid: string, target: Target): number | null {
  if (!Number.isFinite(value)) return null;
  const factor = WIKIDATA_UNITS[unitQid]?.[target];
  if (factor === undefined) return null;
  return value * factor;
}
