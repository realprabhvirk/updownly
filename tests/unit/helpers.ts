import type { Fact, MetricDefinition } from '../../src/data/schema';
import { buildPool } from '../../src/game/queue';

export const TEST_METRIC: MetricDefinition = {
  id: 'test-metric',
  label: 'Test value',
  unit: 'm',
  unitLabel: 'm',
  format: 'decimal',
  higherWord: 'higher',
  lowerWord: 'lower',
  comparisonDescription: 'A test metric.',
};

export function makeFacts(values: number[], opts: { group?: string; metricId?: string; unit?: string } = {}): Fact[] {
  return values.map((value, i) => ({
    id: `test:e${i}`,
    entityId: `e${i}`,
    entityName: `Entity ${i}`,
    categoryId: 'test',
    metricId: opts.metricId ?? TEST_METRIC.id,
    comparisonGroupId: opts.group ?? 'test-metric|test|2024',
    value,
    unit: opts.unit ?? 'm',
    periodKey: '2024',
    periodLabel: '2024',
    sourceId: 'test-source',
    sourceRecordId: `r${i}`,
  }));
}

export function makePool(values: number[]) {
  return buildPool(makeFacts(values), TEST_METRIC);
}

/** Manually controllable time source for Sprint tests. */
export function fakeTime(start = 1_000_000) {
  let mono = 0;
  let wall = start;
  return {
    source: { mono: () => mono, wall: () => wall },
    advance(ms: number) {
      mono += ms;
      wall += ms;
    },
    /** Simulate a suspended tab: wall clock moves, monotonic does not. */
    suspend(ms: number) {
      wall += ms;
    },
    /** Simulate the user moving the system clock backwards. */
    rewindWall(ms: number) {
      wall -= ms;
    },
  };
}
