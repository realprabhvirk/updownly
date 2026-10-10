/** Shared types for the data pipeline. */

export type BuiltFact = {
  entityId: string;
  name: string;
  value: number;
  sourceRecordId?: string;
  context?: string;
  note?: string;
};

export type BuiltCollection = {
  collectionId: string;
  sourceId: string;
  periodKey: string;
  periodLabel: string;
  facts: BuiltFact[];
};

/** Records every excluded observation with a reason, for DATA-COVERAGE.md. */
export class ExclusionLog {
  readonly entries = new Map<string, Map<string, { count: number; examples: string[] }>>();

  add(collectionId: string, reason: string, example: string): void {
    let byReason = this.entries.get(collectionId);
    if (!byReason) {
      byReason = new Map();
      this.entries.set(collectionId, byReason);
    }
    const e = byReason.get(reason) ?? { count: 0, examples: [] };
    e.count++;
    if (e.examples.length < 3) e.examples.push(example);
    byReason.set(reason, e);
  }

  toJSON(): Record<string, Record<string, { count: number; examples: string[] }>> {
    const out: Record<string, Record<string, { count: number; examples: string[] }>> = {};
    for (const [c, m] of this.entries) out[c] = Object.fromEntries(m);
    return out;
  }
}
