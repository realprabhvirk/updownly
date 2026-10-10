/**
 * Shared data model for UPDOWNLY. Used by the build-time data pipeline
 * (scripts/data) and by the app at runtime, so both agree on one shape.
 */

/** One source-backed observation: entity + metric + period + value. */
export type Fact = {
  /** Stable, globally unique id: `${collectionId}:${entityId}`. */
  id: string;
  entityId: string;
  entityName: string;
  /** Short disambiguating context shown under the name, e.g. a country. */
  context?: string;

  categoryId: string;
  metricId: string;
  /** Facts are only ever compared inside one comparison group. */
  comparisonGroupId: string;

  /** Canonical numeric value in `unit`. Never altered by display formatting. */
  value: number;
  unit: string;

  periodKey: string;
  periodLabel: string;

  sourceId: string;
  sourceRecordId?: string;
  sourceUrl?: string;
  note?: string;
};

/** Number formatting rules. Each metric picks exactly one. */
export type FormatKind =
  | 'count' // 27,204,809 people → "27.2 million"
  | 'currency' // US$ → "$3.21 trillion"
  | 'decimal' // fixed decimals with grouping
  | 'percent' // 0–100 values → "87.3%"
  | 'mass-grams' // grams → "45 g", "2.3 kg", "4.1 t"
  | 'duration-minutes'; // minutes → "2 h 22 min"

export type MetricDefinition = {
  id: string;
  /** Short label, e.g. "Elevation". */
  label: string;
  /** Canonical unit code stored with every fact. */
  unit: string;
  /** Unit text shown after a value, singular/plural handled by `format`. */
  unitLabel: string;
  format: FormatKind;
  /**
   * Decimal places for `decimal`/`percent` formats (default 0). 'auto'
   * scales precision with magnitude for values spanning many orders.
   */
  decimals?: number | 'auto';
  /** For comparisons phrased naturally: "taller", "longer"… */
  higherWord: string;
  lowerWord: string;
  /** One sentence describing what is compared. */
  comparisonDescription: string;
  methodologyNote?: string;
};

export type FactSource = {
  id: string;
  name: string;
  /** Publisher or project homepage. */
  url: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
  /** Template for per-record links. `{id}` is replaced by sourceRecordId. */
  recordUrlTemplate?: string;
  retrievedAt: string;
  datasetVersion?: string;
};

export type GroupId =
  | 'world'
  | 'geography'
  | 'space'
  | 'transport'
  | 'animals'
  | 'food'
  | 'buildings'
  | 'culture';

export type CategoryGroup = {
  id: GroupId;
  title: string;
  /** Solid identifier colour used for tiles and the reference card. */
  colour: string;
};

export type CollectionDefinition = {
  /** Per-record link template overriding the source's, `{id}` = sourceRecordId. */
  recordUrlTemplate?: string;
  id: string;
  groupId: GroupId;
  metricId: string;
  sourceId: string;
  /** Tile title, e.g. "Mountains". */
  title: string;
  /** Metric half of the title, e.g. "Elevation". */
  subtitle: string;
  /** One-line tile description. */
  descriptor: string;
  /** Longer description for the category sheet. */
  description: string;
  /** Phosphor icon name (see src/components/Icon.tsx). */
  icon: string;
  /** Eligible for Quick Play / Sprint random picks and the Daily Challenge. */
  featured?: boolean;
  /** Short entity noun used in prompts: "mountain", "country"… */
  entityNoun: string;
};

/** Compact on-disk row: [entityId, name, value, sourceRecordId, context, note]. */
export type CompactFactRow = [
  entityId: string,
  name: string,
  value: number,
  sourceRecordId?: string | null,
  context?: string | null,
  note?: string | null,
];

/** App-ready collection file written by the pipeline. */
export type CollectionFile = {
  collectionId: string;
  metricId: string;
  comparisonGroupId: string;
  unit: string;
  periodKey: string;
  periodLabel: string;
  sourceId: string;
  facts: CompactFactRow[];
};

/** Generated summary of every published collection and source. */
export type DataManifest = {
  generatedAt: string;
  dataVersion: string;
  totalFacts: number;
  totalEntities: number;
  collections: Array<{
    id: string;
    count: number;
    periodKey: string;
    periodLabel: string;
    min: number;
    max: number;
  }>;
  sources: FactSource[];
};
