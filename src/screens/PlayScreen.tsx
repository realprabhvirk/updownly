import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { dailyInfo, loadError, loadingCollection, randomFeatured, session, startGame, todaysDaily } from '../app/game';
import { navigate } from '../app/router';
import { installSheetOpen, openCategory, save, updateSettings } from '../app/store';
import { Wordmark } from '../components/BrandMark';
import { CategoryTile } from '../components/CategoryTile';
import { Icon } from '../components/Icon';
import { CATALOG, TOTAL_FACTS, type CollectionInfo } from '../data/catalog';
import { GROUPS } from '../data/definitions';
import type { GroupId } from '../data/schema';
import { BRAND, DIFFICULTY_LABEL } from '../design/strings';
import { isIOSSafari, isStandalone } from '../services/platform';

/** Set by "Change category" on the results screen. */
export const focusCategories = signal(false);

const SMALL_PER_GROUP = 4;

function ResumeBanner() {
  const s = session.value;
  if (!s) return null;
  const st = s.state.value;
  if (st.phase === 'finished') return null;
  return (
    <button type="button" class="resume" onClick={() => navigate('game')}>
      <span class="resume-dot" aria-hidden="true" />
      <span class="resume-text">
        <strong>Game in progress</strong>
        <span>
          {s.info.title} · {s.info.subtitle} — score {st.score}
        </span>
      </span>
      <span class="resume-cta">
        Resume <Icon name="arrow-right" size={16} />
      </span>
    </button>
  );
}

function InstallHint() {
  const s = save.value;
  if (!isIOSSafari() || isStandalone() || s.settings.installHintDismissed || s.stats.gamesPlayed < 1) return null;
  return (
    <div class="hint">
      <Icon name="device-mobile" size={22} />
      <p>
        Add UPDOWNLY to your Home Screen for full-screen, offline play.{' '}
        <button type="button" class="link" onClick={() => (installSheetOpen.value = true)}>
          Show me how
        </button>
      </p>
      <button
        type="button"
        class="icon-btn"
        aria-label="Dismiss"
        onClick={() => updateSettings({ installHintDismissed: true })}
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

function Modes() {
  const s = save.value;
  const daily = todaysDaily();
  const dInfo = dailyInfo();
  const busy = loadingCollection.value !== null;
  const difficulty = s.settings.defaultDifficulty;

  const quickPlay = () => {
    const info = randomFeatured(s.settings.recentCollections[0]);
    void startGame({ collectionId: info.id, mode: 'classic', difficulty });
  };
  const sprint = () => {
    const info = randomFeatured(s.settings.recentCollections[0]);
    void startGame({ collectionId: info.id, mode: 'sprint', difficulty });
  };
  const playDaily = () => {
    void startGame({ collectionId: dInfo.id, mode: 'daily', difficulty: 'normal', practice: Boolean(daily) });
  };

  return (
    <section class="modes" aria-label="Game modes">
      <button type="button" class="mode mode-quick" onClick={quickPlay} disabled={busy}>
        <span class="mode-art" aria-hidden="true">
          <svg viewBox="140 190 744 644" width="116" height="100">
            <path d="M352 200 L552 440 L432 440 L432 660 L272 660 L272 440 L152 440 Z" fill="currentColor" />
            <path d="M672 824 L472 584 L592 584 L592 364 L752 364 L752 584 L872 584 Z" fill="var(--c-butter)" />
          </svg>
        </span>
        <span class="mode-eyebrow">Quick Play</span>
        <span class="mode-title">Play now</span>
        <span class="mode-sub">
          Classic · Random category · {DIFFICULTY_LABEL[difficulty]}
        </span>
      </button>
      <div class="mode-row">
        <button type="button" class="mode mode-daily" onClick={playDaily} disabled={busy}>
          <span class="mode-eyebrow">
            <Icon name="calendar-check" size={16} /> Daily
          </span>
          <span class="mode-title">{daily ? `${daily.score}/10` : 'Today'}</span>
          <span class="mode-sub">
            {daily ? 'Done · practise again' : `${dInfo.title} · ${dInfo.subtitle}`}
          </span>
        </button>
        <button type="button" class="mode mode-sprint" onClick={sprint} disabled={busy}>
          <span class="mode-eyebrow">
            <Icon name="timer" size={16} /> Sprint
          </span>
          <span class="mode-title">60s</span>
          <span class="mode-sub">{s.stats.bestSprint > 0 ? `Best ${s.stats.bestSprint}` : 'Beat the clock'}</span>
        </button>
      </div>
    </section>
  );
}

function matches(info: CollectionInfo, q: string): boolean {
  const hay = `${info.title} ${info.subtitle} ${info.descriptor} ${info.group.title} ${info.metric.label}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function Browser() {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<'all' | GroupId>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLElement>(null);
  const best = save.value.stats.bestByCategory;

  useEffect(() => {
    if (focusCategories.value) {
      focusCategories.value = false;
      ref.current?.scrollIntoView({ block: 'start' });
      ref.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    }
  }, []);

  const results = useMemo(() => (query.trim() ? CATALOG.filter((c) => matches(c, query)) : []), [query]);
  const groups = GROUPS.filter((g) => group === 'all' || g.id === group);
  const open = (id: string) => (openCategory.value = id);

  return (
    <section class="browser" id="categories" ref={ref} aria-labelledby="categories-title">
      <div class="browser-head">
        <h2 id="categories-title" class="section-title">
          Categories
        </h2>
        <span class="browser-count">
          {CATALOG.length} categories · {TOTAL_FACTS.toLocaleString('en-GB')} facts
        </span>
      </div>
      <label class="search">
        <Icon name="magnifying-glass" size={18} />
        <input
          type="search"
          placeholder="Search mountains, foods, planets…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          aria-label="Search categories"
          enterKeyHint="search"
        />
      </label>
      {!query.trim() && (
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
      )}

      {query.trim() ? (
        results.length > 0 ? (
          <div class="tile-grid" role="list" aria-label="Search results">
            {results.map((c) => (
              <CategoryTile info={c} onOpen={open} best={best[c.id]?.classic} />
            ))}
          </div>
        ) : (
          <div class="empty">
            <Icon name="magnifying-glass" size={28} />
            <p>No categories match “{query}”.</p>
            <button type="button" class="link" onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        )
      ) : (
        groups.map((g) => {
          const items = CATALOG.filter((c) => c.groupId === g.id);
          if (items.length === 0) return null;
          const [first, ...rest] = items;
          const showAll = expanded.has(g.id) || group !== 'all';
          const visible = showAll ? rest : rest.slice(0, SMALL_PER_GROUP);
          return (
            <div class="group" style={{ '--group': g.colour }}>
              <h3 class="group-title">
                <span class="group-bar" aria-hidden="true" />
                {g.title}
                <span class="group-n">{items.length}</span>
              </h3>
              <CategoryTile info={first!} feature onOpen={open} best={best[first!.id]?.classic} />
              {visible.length > 0 && (
                <div class="tile-grid">
                  {visible.map((c) => (
                    <CategoryTile info={c} onOpen={open} best={best[c.id]?.classic} />
                  ))}
                </div>
              )}
              {!showAll && rest.length > SMALL_PER_GROUP && (
                <button
                  type="button"
                  class="more"
                  onClick={() => setExpanded(new Set([...expanded, g.id]))}
                  aria-label={`Show all ${items.length} ${g.title} categories`}
                >
                  Show all {items.length} <Icon name="caret-down" size={16} />
                </button>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

export function PlayScreen() {
  const stats = save.value.stats;
  return (
    <div class="play">
      <header class="play-header">
        <h1 class="sr-only">UPDOWNLY</h1>
        <Wordmark size={30} />
        {stats.bestStreak > 0 && (
          <span class="streak-chip" title="Your best streak">
            <Icon name="lightning" size={16} />
            <span>
              Best <strong>{stats.bestStreak}</strong>
            </span>
          </span>
        )}
      </header>
      <p class="tagline">{BRAND.tagline}</p>
      <ResumeBanner />
      {loadError.value && (
        <div class="hint hint-error" role="alert">
          <Icon name="warning-circle" size={22} />
          <p>{loadError.value}</p>
        </div>
      )}
      <Modes />
      <InstallHint />
      <Browser />
    </div>
  );
}
