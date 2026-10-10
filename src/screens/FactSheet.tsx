import { session, lastResult } from '../app/game';
import { openFactId } from '../app/store';
import { BottomSheet } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { collectionInfo } from '../data/catalog';
import { formatFull } from '../data/format';
import type { Fact } from '../data/schema';

function findFact(id: string): Fact | undefined {
  const st = session.value?.state.value;
  const pools = [
    ...(st?.history ?? []),
    ...(st?.current ? [st.current] : []),
    ...(lastResult.value?.history ?? []),
  ];
  for (const q of pools) {
    if (q.reference.id === id) return q.reference;
    // A challenger's details are only available once it has been answered.
    if (q.challenger.id === id && q.answer !== undefined) return q.challenger;
  }
  return undefined;
}

/** Full value, period, source and methodology for one fact. */
export function FactSheet() {
  const id = openFactId.value;
  const fact = id ? findFact(id) : undefined;
  const close = () => (openFactId.value = null);
  if (!fact) return <BottomSheet open={false} onClose={close} label="">{null}</BottomSheet>;
  const info = collectionInfo(fact.categoryId)!;
  return (
    <BottomSheet open onClose={close} label={`About ${fact.entityName}`}>
      <div class="factsheet">
        <p class="cat-group">
          {info.title} · {info.subtitle}
        </p>
        <h2 class="factsheet-title">{fact.entityName}</h2>
        {fact.context && <p class="factsheet-context">{fact.context}</p>}
        <dl class="kv">
          <div>
            <dt>Value</dt>
            <dd class="tabular">{formatFull(fact.value, info.metric)}</dd>
          </div>
          <div>
            <dt>Measure</dt>
            <dd>{info.metric.comparisonDescription}</dd>
          </div>
          <div>
            <dt>Period</dt>
            <dd>{fact.periodLabel}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {info.source.name} ({info.source.licence})
            </dd>
          </div>
          {info.metric.methodologyNote && (
            <div>
              <dt>Method</dt>
              <dd>{info.metric.methodologyNote}</dd>
            </div>
          )}
          {fact.note && (
            <div>
              <dt>Note</dt>
              <dd>{fact.note}</dd>
            </div>
          )}
        </dl>
        {fact.sourceUrl && (
          <a class="btn btn-secondary btn-m btn-block" href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">
            <span class="btn-label">View source record</span>
            <Icon name="arrow-square-out" size={18} />
          </a>
        )}
      </div>
    </BottomSheet>
  );
}
