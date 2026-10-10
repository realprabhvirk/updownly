/**
 * Metric-specific number formatting. Formatting only ever produces strings;
 * the numeric value used for comparison is never changed.
 */
import type { MetricDefinition } from './schema';

export type FormattedValue = {
  /** Number part, e.g. "27.2" or "8,849". */
  value: string;
  /** Unit/scale part, e.g. "million people" or "m". */
  unit: string;
};

const group = (n: number, decimals: number) =>
  n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Round to `sig` significant digits and format with grouping. */
function significant(n: number, sig = 3): string {
  if (n === 0) return '0';
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  const decimals = Math.max(0, sig - 1 - magnitude);
  const rounded = Number(n.toFixed(decimals));
  // Rounding can carry into a new magnitude (9.996 → 10.0); recompute.
  const mag2 = rounded === 0 ? magnitude : Math.floor(Math.log10(Math.abs(rounded)));
  const d2 = Math.max(0, sig - 1 - mag2);
  return group(rounded, Math.min(d2, decimals));
}

function autoDecimals(n: number): number {
  const a = Math.abs(n);
  if (a === 0) return 0;
  if (a < 1) return Math.min(4, Math.max(2, 2 - Math.floor(Math.log10(a))));
  if (a < 10) return 2;
  if (a < 100) return 1;
  return 0;
}

const SINGULAR: Record<string, string> = {
  people: 'person',
  floors: 'floor',
  years: 'year',
  days: 'day',
  'light-years': 'light-year',
  spectators: 'spectator',
};

function unitFor(unitLabel: string, numeric: number): string {
  return numeric === 1 && SINGULAR[unitLabel] ? SINGULAR[unitLabel]! : unitLabel;
}

const SCALES: Array<[number, string]> = [
  [1e12, 'trillion'],
  [1e9, 'billion'],
  [1e6, 'million'],
];

/** Compact, game-screen format: readable at arm's length. */
export function formatValue(value: number, metric: MetricDefinition): FormattedValue {
  switch (metric.format) {
    case 'count': {
      for (const [scale, word] of SCALES) {
        if (Math.abs(value) >= scale) {
          return { value: significant(value / scale), unit: `${word} ${metric.unitLabel}`.trim() };
        }
      }
      const rounded = Math.round(value);
      return { value: group(rounded, 0), unit: unitFor(metric.unitLabel, rounded) };
    }
    case 'currency': {
      for (const [scale, word] of SCALES) {
        if (Math.abs(value) >= scale) return { value: `$${significant(value / scale)}`, unit: word };
      }
      return { value: `$${group(Math.round(value), 0)}`, unit: '' };
    }
    case 'percent': {
      const d = typeof metric.decimals === 'number' ? metric.decimals : 1;
      return { value: `${group(value, d)}%`, unit: metric.unitLabel.replace(/^%\s*/, '') };
    }
    case 'mass-grams': {
      if (value >= 1e6) return { value: significant(value / 1e6), unit: 't' };
      if (value >= 1000) return { value: significant(value / 1000), unit: 'kg' };
      return { value: significant(value), unit: 'g' };
    }
    case 'duration-minutes': {
      const total = Math.round(value);
      const h = Math.floor(total / 60);
      const min = total % 60;
      if (h === 0) return { value: String(min), unit: 'min' };
      return { value: `${h} h ${min}`, unit: 'min' };
    }
    case 'decimal':
    default: {
      const d = metric.decimals === 'auto' ? autoDecimals(value) : (metric.decimals ?? 0);
      const text = group(value, d);
      return { value: text, unit: unitFor(metric.unitLabel, Number(value.toFixed(d))) };
    }
  }
}

/** Single-string compact form, e.g. "8,849 m". */
export function formatInline(value: number, metric: MetricDefinition): string {
  const f = formatValue(value, metric);
  return f.unit ? `${f.value} ${f.unit}` : f.value;
}

/** Full-precision form for the fact detail sheet, e.g. "27,204,809 people". */
export function formatFull(value: number, metric: MetricDefinition): string {
  const exact = value.toLocaleString('en-GB', { maximumFractionDigits: 6 });
  switch (metric.format) {
    case 'currency':
      return `US$${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
    case 'percent':
      return `${value.toLocaleString('en-GB', { maximumFractionDigits: 3 })}% ${metric.unitLabel.replace(/^%\s*/, '')}`.trim();
    case 'mass-grams':
      return `${exact} g (${formatInline(value, metric)})`;
    case 'duration-minutes':
      return `${exact} minutes (${formatInline(value, metric)})`;
    default:
      return `${exact} ${unitFor(metric.unitLabel, value)}`.trim();
  }
}

/**
 * Key used to reject comparisons that would *look* tied on screen even when
 * the underlying values differ (e.g. 27.21 vs 27.24 million → "27.2").
 */
export function displayKey(value: number, metric: MetricDefinition): string {
  return formatInline(value, metric);
}

/**
 * Placeholder for a hidden value. Must not depend on the value in any way
 * (a "kg" vs "t" unit, or "million" vs "billion", would leak the answer).
 */
export function hiddenValue(metric: MetricDefinition): FormattedValue {
  switch (metric.format) {
    case 'currency':
      return { value: '$?', unit: '' };
    case 'percent':
      return { value: '?%', unit: metric.unitLabel.replace(/^%\s*/, '') };
    case 'mass-grams':
      return { value: '?', unit: '' };
    case 'duration-minutes':
      return { value: '?', unit: 'min' };
    default:
      return { value: '?', unit: metric.unitLabel };
  }
}
