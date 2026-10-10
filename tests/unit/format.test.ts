import { describe, expect, it } from 'vitest';
import { metricById } from '../../src/data/definitions';
import { displayKey, formatFull, formatInline, formatValue } from '../../src/data/format';
import type { MetricDefinition } from '../../src/data/schema';

const metric = (id: string): MetricDefinition => {
  const m = metricById(id);
  if (!m) throw new Error(id);
  return m;
};

describe('formatValue', () => {
  it('formats populations with scale words', () => {
    expect(formatInline(27_204_809, metric('population'))).toBe('27.2 million people');
    expect(formatInline(1_463_865_525, metric('population'))).toBe('1.46 billion people');
    expect(formatInline(341_784_857, metric('population'))).toBe('342 million people');
    expect(formatInline(9_492, metric('population'))).toBe('9,492 people');
  });

  it('formats currency', () => {
    expect(formatInline(3.21e12, metric('gdp'))).toBe('$3.21 trillion');
    expect(formatInline(845_000_000_000, metric('gdp'))).toBe('$845 billion');
    expect(formatInline(64_712.4, metric('gdp-per-capita'))).toBe('$64,712');
  });

  it('formats elevations without changing the value', () => {
    const v = 8848.86;
    expect(formatInline(v, metric('elevation'))).toBe('8,849 m');
    expect(v).toBe(8848.86);
  });

  it('formats percentages', () => {
    expect(formatValue(87.345, metric('internet-users'))).toEqual({ value: '87.3%', unit: 'of people' });
  });

  it('formats masses adaptively', () => {
    const m = metric('body-mass');
    expect(formatInline(1.9, m)).toBe('1.90 g');
    expect(formatInline(45.2, m)).toBe('45.2 g');
    expect(formatInline(2350, m)).toBe('2.35 kg');
    expect(formatInline(450_000, m)).toBe('450 kg');
    expect(formatInline(149_000_000, m)).toBe('149 t');
  });

  it('formats running times', () => {
    const m = metric('running-time');
    expect(formatInline(98, m)).toBe('1 h 38 min');
    expect(formatInline(43, m)).toBe('43 min');
    expect(formatInline(120, m)).toBe('2 h 0 min');
  });

  it('formats negative temperatures', () => {
    expect(formatInline(-38.83, metric('melting-point'))).toBe('-38.8 °C');
  });

  it('uses adaptive decimals for wide-ranging metrics', () => {
    const m = metric('orbital-period');
    expect(formatInline(0.0907, m)).toBe('0.0907 days');
    expect(formatInline(3.5249, m)).toBe('3.52 days');
    expect(formatInline(365.25, m)).toBe('365 days');
    expect(formatInline(402_000_000, m)).toBe('402,000,000 days');
  });

  it('uses singular units for one', () => {
    expect(formatInline(1, metric('floors'))).toBe('1 floor');
  });

  it('carries rounding into the next magnitude correctly', () => {
    expect(formatInline(999_600, metric('population'))).toBe('999,600 people');
    expect(formatInline(9_996_000, metric('population'))).toBe('10.0 million people');
  });

  it('full format keeps the precise value', () => {
    expect(formatFull(27_204_809, metric('population'))).toBe('27,204,809 people');
    expect(formatFull(8848.86, metric('elevation'))).toBe('8,848.86 m');
    expect(formatFull(149_000_000, metric('body-mass'))).toBe('149,000,000 g (149 t)');
  });

  it('display keys detect values that look identical', () => {
    const m = metric('population');
    expect(displayKey(27_210_000, m)).toBe(displayKey(27_240_000, m));
    expect(displayKey(27_210_000, m)).not.toBe(displayKey(27_260_000, m));
  });
});
