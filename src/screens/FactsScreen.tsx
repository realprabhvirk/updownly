import { signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { todayKey } from '../app/game';
import { BottomSheet } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { Segmented } from '../components/Segmented';
import { CATALOG, collectionInfo, featuredCollections, type CollectionInfo } from '../data/catalog';
import { GROUPS } from '../data/definitions';
import { formatFull, formatValue } from '../data/format';
import { BOTTOM_N, TOP_N, barFraction, factOfTheDay, hasMeaningfulBottom, highlightCount, ranked, type RankOrder } from '../data/highlights';
import { loadFacts } from '../data/loader';
import type { Fact, GroupId } from '../data/schema';
import '../styles/facts.css';

/** Kept outside the component so switching tabs keeps your place. */
const selected = signal<string | null>(null);
const order = signal<RankOrder>('highest');

const PAGE = 25;
const count = (c: CollectionInfo) => highlightCount(c.count, hasMeaningfulBottom(c.sourceId));
const TOTAL_HIGHLIGHTS = CATALOG.reduce((n, c) => n + count(c), 0);
const n = (x: number) => x.toLocaleString('en-GB');

type Detail = { fact: Fact; rank: number; order: RankOrder; info: CollectionInfo };

/** Loads a collection's facts once per id (the loader caches the chunk). */
function useFacts(id: string | null): Fact[] | null {
  const [state, setState] = useState<{ id: string; facts: Fact[] } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    loadFacts(id)
      .then((facts) => live && setState({ id, facts }))
      .catch(() => live && setState({ id, facts: [] }));
    return () => {
      live = false;
    };
  }, [id]);
  return state && state.id === id ? state.facts : null;
}

function Value({ fact, info }: { fact: Fact; info: CollectionInfo }) {
  const f = formatValue(fact.value, info.metric);
  return (
    <span class="rank-value tabular">
      {f.value}
      {f.unit && <small> {f.unit}</small>}
    </span>
  );
}

function FactOfTheDay({ onOpen }: { onOpen: (d: Detail) => void }) {
  const pick = useMemo(() => factOfTheDay(todayKey(), featuredCollections().map((c) => c.id)), []);
  const info = pick ? collectionInfo(pick.collectionId) : undefined;
  const facts = useFacts(info?.id ?? null);
  if (!pick || !info) return null;
  const top = facts ? ranked(facts, 'highest', 10) : [];
  const fact = top[Math.min(pick.rank, top.length - 1)];
  const value = fact ? formatValue(fact.value, info.metric) : null;
  return (
    <button
      type="button"
      class="fotd"
      style={{ '--cat': info.group.colour }}
      disabled={!fact}
      onClick={() => fact && onOpen({ fact, rank: Math.min(pick.rank, top.length - 1) + 1, order: 'highest', info })}
      data-testid="fact-of-the-day"
    >
      <span class="fotd-eyebrow">
        <Icon name="lightbulb" size={16} /> Fact of the day
      </span>
      {fact && value ? (
        <>
          <span class="fotd-rank">
            No. {Math.min(pick.rank, top.length - 1) + 1} for {info.metric.label.toLowerCase()} · {info.title}
          </span>
          <span class="fotd-name">{fact.entityName}</span>
          <span class="fotd-value tabular">
            {value.value}
            {value.unit && <small> {value.unit}</small>}
          </span>
          {fact.context && <span class="fotd-ctx">{fact.context}</span>}
        </>
      ) : (
        <span class="fotd-name">Loading…</span>
      )}
    </button>
  );
}

function Overview({ onOpen }: { onOpen: (d: Detail) => void }) {
  const [group, setGroup] = useState<'all' | GroupId>('all');
  const groups = GROUPS.filter((g) => group === 'all' || g.id === group);
  return (
    <>
      <h1 class="page-title">Facts</h1>
      <p class="lead">
        The record holders behind the game: the top {TOP_N} of every category, plus the bottom {BOTTOM_N} wherever the
        low end is a real record — {n(TOTAL_HIGHLIGHTS)} source-backed facts to explore.
      </p>
      <FactOfTheDay onOpen={onOpen} />
      <div class="chips" role="toolbar" aria-label="Filter by group">
        <button type="button" class={`chip${group === 'all' ? ' is-on' : ''}`} aria-pressed={group === 'all'} onClick={() => setGroup('all')}>
          All
        </button>
        {GROUPS.map((g) => (
          <button
            type="button"
            class={`chip${group === g.id ? ' is-on' : ''}`}
            aria-pressed={group === g.id}
            style={{ '--chip': g.colour }}
            onClick={() => setGroup(g.id)}
          >
            <span class="chip-dot" aria-hidden="true" />
            {g.title}
          </button>
        ))}
      </div>
      {groups.map((g) => {
        const items = CATALOG.filter((c) => c.groupId === g.id);
        if (items.length === 0) return null;
        return (
          <section class="facts-group" aria-label={g.title}>
            <h2 class="group-title" style={{ '--group': g.colour }}>
              <span class="group-bar" aria-hidden="true" />
              {g.title}
            </h2>
            <ul class="facts-list">
              {items.map((c) => (
                <li>
                  <button
                    type="button"
                    class="facts-row"
                    onClick={() => {
                      selected.value = c.id;
                      window.scrollTo(0, 0);
                    }}
                    aria-label={`${c.title}: ${c.subtitle}. ${count(c)} facts.`}
                  >
                    <span class="facts-icon" style={{ '--tile': c.group.colour }} aria-hidden="true">
                      <Icon name={c.icon} size={20} />
                    </span>
                    <span class="facts-text">
                      <strong>
                        {c.title} · {c.subtitle}
                      </strong>
                      <span>{c.descriptor}</span>
                    </span>
                    <span class="facts-count tabular">{count(c)}</span>
                    <Icon name="caret-right" size={16} class="row-chevron" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p class="fine">Every value comes from the bundled, source-backed dataset and works offline.</p>
    </>
  );
}

function Ranking({ info, onOpen }: { info: CollectionInfo; onOpen: (d: Detail) => void }) {
  const facts = useFacts(info.id);
  const [shown, setShown] = useState(PAGE);
  const withBottom = hasMeaningfulBottom(info.sourceId);
  const dir = withBottom ? order.value : 'highest';
  const limit = dir === 'highest' ? TOP_N : BOTTOM_N;
  useEffect(() => setShown(PAGE), [info.id, dir]);

  const list = useMemo(() => (facts ? ranked(facts, dir, limit) : []), [facts, dir, limit]);
  const visible = list.slice(0, shown);
  const values = list.map((f) => f.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <>
      <button type="button" class="back" onClick={() => (selected.value = null)}>
        <Icon name="caret-left" size={18} /> Facts
      </button>
      <header class="rank-head" style={{ '--cat': info.group.colour }}>
        <span class="cat-icon" aria-hidden="true">
          <Icon name={info.icon} size={28} />
        </span>
        <div>
          <p class="cat-group">{info.group.title}</p>
          <h1 class="cat-title">
            {info.title} <span>{info.subtitle}</span>
          </h1>
        </div>
      </header>
      <p class="rank-desc">
        {info.metric.comparisonDescription} <span class="rank-period">{info.periodLabel}</span>
      </p>
      {withBottom ? (
        <Segmented
          label="Order"
          value={dir}
          options={[
            { value: 'highest', label: `Top ${Math.min(TOP_N, info.count)}` },
            { value: 'lowest', label: `Bottom ${Math.min(BOTTOM_N, info.count)}` },
          ]}
          onChange={(v) => (order.value = v)}
        />
      ) : (
        <p class="rank-note">
          Top {Math.min(TOP_N, info.count)}. Only {info.entityNoun}s above a size threshold are included, so there is no
          bottom list.
        </p>
      )}
      {!facts ? (
        <p class="rank-loading" aria-busy="true">
          Loading…
        </p>
      ) : (
        <ol class="rank-list" style={{ '--cat': info.group.colour }} aria-label={`${dir === 'highest' ? 'Highest' : 'Lowest'} ${info.metric.label}`}>
          {visible.map((f, i) => (
            <li class={i < 3 ? 'is-podium' : undefined}>
              <button type="button" class="rank-row" onClick={() => onOpen({ fact: f, rank: i + 1, order: dir, info })}>
                <span class="rank-n tabular">{i + 1}</span>
                <span class="rank-main">
                  <span class="rank-name">{f.entityName}</span>
                  {f.context && <span class="rank-ctx">{f.context}</span>}
                  <span class="rank-bar" aria-hidden="true">
                    <span style={{ transform: `scaleX(${barFraction(f.value, min, max)})` }} />
                  </span>
                </span>
                <Value fact={f} info={info} />
              </button>
            </li>
          ))}
        </ol>
      )}
      {facts && shown < list.length && (
        <button type="button" class="more" onClick={() => setShown(list.length)}>
          Show all {list.length} <Icon name="caret-down" size={16} />
        </button>
      )}
      <p class="fine">
        Source: {info.source.name} ({info.source.licence}). Ranked from {n(info.count)} facts in this category.
      </p>
    </>
  );
}

function FactDetail({ detail, onClose }: { detail: Detail | null; onClose: () => void }) {
  if (!detail) return <BottomSheet open={false} onClose={onClose} label="">{null}</BottomSheet>;
  const { fact, info, rank } = detail;
  return (
    <BottomSheet open onClose={onClose} label={`About ${fact.entityName}`}>
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
            <dt>Rank</dt>
            <dd>
              {detail.order === 'highest' ? `No. ${rank} highest` : `No. ${rank} lowest`} of {n(info.count)}
            </dd>
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

/** Browse the most interesting facts: the extremes of every category. */
export function FactsScreen() {
  const [detail, setDetail] = useState<Detail | null>(null);
  const info = selected.value ? collectionInfo(selected.value) : undefined;
  const open = (d: Detail) => setDetail(d);
  return (
    <div class="page facts">
      {info ? <Ranking info={info} onOpen={open} /> : <Overview onOpen={open} />}
      <FactDetail detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
