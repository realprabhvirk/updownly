/**
 * Game session controller: creates engines, drives the Sprint clock, and
 * turns finished games into records. UI components call these functions;
 * they never mutate scores themselves.
 */
import { signal, type Signal } from '@preact/signals';
import { collectionInfo, featuredCollections, type CollectionInfo } from '../data/catalog';
import { loadPool } from '../data/loader';
import { newlyUnlocked, type AchievementId } from '../game/achievements';
import { dailyCollectionId, dailySequence, dailyStreak, localDateKey, DAILY_ALGORITHM_VERSION, DAILY_DIFFICULTY } from '../game/daily';
import { GameEngine } from '../game/engine';
import type { Pool } from '../game/queue';
import { createRng, randomInt, randomSeed } from '../game/rng';
import { applyRecord, recordFromState, type GameRecord, type RecordFlags } from '../game/scoring';
import type { Difficulty, GameState, Mode, Question } from '../game/types';
import { MAX_RECENT_GAMES } from '../services/storage';
import { navigate, route } from './router';
import { save, updateSave } from './store';

export type Session = {
  engine: GameEngine;
  info: CollectionInfo;
  state: Signal<GameState>;
};

export type ResultSummary = {
  record: GameRecord;
  flags: RecordFlags;
  info: CollectionInfo;
  history: Question[];
  finishReason: GameState['finishReason'];
  newAchievements: AchievementId[];
  daily?: { official: boolean; streak: number; dateKey: string };
};

export const session = signal<Session | null>(null);
export const loadingCollection = signal<string | null>(null);
export const loadError = signal<string | null>(null);
export const lastResult = signal<ResultSummary | null>(null);

// ── Deterministic seeds for automated tests (never active in production) ──
let e2eSeed: number | null = null;
let e2eDate: string | null = null;
let gameCounter = 0;
if (__E2E__ && typeof location !== 'undefined') {
  const params = new URLSearchParams(location.search);
  if (params.get('seed')) e2eSeed = Number(params.get('seed'));
  if (params.get('date')) e2eDate = params.get('date');
}

export function todayKey(): string {
  return e2eDate ?? localDateKey();
}

function nextSeed(): number {
  gameCounter++;
  return e2eSeed !== null ? e2eSeed + gameCounter : randomSeed();
}

/** Today's Daily Challenge collection. */
export function dailyInfo(dateKey = todayKey()): CollectionInfo {
  const eligible = featuredCollections().map((c) => c.id);
  return collectionInfo(dailyCollectionId(dateKey, eligible))!;
}

/** A random featured collection for Quick Play / Sprint. */
export function randomFeatured(exclude?: string): CollectionInfo {
  const list = featuredCollections().filter((c) => c.id !== exclude);
  const rng = createRng(nextSeed());
  return list[randomInt(rng, list.length)]!;
}

let sprintTimer: ReturnType<typeof setInterval> | null = null;

function stopSprintTimer(): void {
  if (sprintTimer !== null) clearInterval(sprintTimer);
  sprintTimer = null;
  document.removeEventListener('visibilitychange', onVisibility);
}

function onVisibility(): void {
  session.value?.engine.tick();
}

export type StartOptions = {
  collectionId: string;
  mode: Mode;
  difficulty: Difficulty;
  practice?: boolean;
  /** Skip the ready screen (the category sheet already showed the details). */
  autoStart?: boolean;
};

export async function startGame(opts: StartOptions): Promise<void> {
  const info = collectionInfo(opts.collectionId);
  if (!info) return;
  endSession();
  loadError.value = null;
  loadingCollection.value = info.id;
  let pool: Pool;
  try {
    pool = await loadPool(info.id);
  } catch {
    loadingCollection.value = null;
    loadError.value = 'This category could not be loaded. Check your connection and try again.';
    return;
  }
  loadingCollection.value = null;

  const isDaily = opts.mode === 'daily';
  const dateKey = isDaily ? todayKey() : undefined;
  const engine = new GameEngine(
    pool,
    {
      mode: opts.mode,
      collectionId: info.id,
      difficulty: isDaily ? DAILY_DIFFICULTY : opts.difficulty,
      ...(isDaily ? { dateKey, practice: Boolean(opts.practice) } : {}),
    },
    {
      rng: createRng(nextSeed()),
      ...(isDaily ? { sequence: dailySequence(dateKey!, pool) } : {}),
    },
  );
  const state = signal<GameState>(engine.getState());
  const s: Session = { engine, info, state };
  engine.subscribe((st) => {
    state.value = st;
    if (st.phase === 'finished') onFinished(s, st);
  });
  session.value = s;

  if (!isDaily) {
    updateSave((sv) => ({
      ...sv,
      settings: {
        ...sv.settings,
        categoryDifficulty: { ...sv.settings.categoryDifficulty, [info.id]: opts.difficulty },
        recentCollections: [info.id, ...sv.settings.recentCollections.filter((x) => x !== info.id)].slice(0, 6),
      },
    }));
  }

  if (opts.mode === 'sprint') {
    stopSprintTimer();
    sprintTimer = setInterval(() => session.value?.engine.tick(), 200);
    document.addEventListener('visibilitychange', onVisibility);
  }
  navigate('game');
  if (opts.autoStart) engine.start();
}

/** Leave without recording anything. */
export function abandonGame(): void {
  const s = session.value;
  if (s) s.engine.abandon();
  endSession();
}

function endSession(): void {
  stopSprintTimer();
  session.value = null;
}

function onFinished(s: Session, st: GameState): void {
  stopSprintTimer();
  if (session.value === s) session.value = null;
  const record = recordFromState(st);
  if (!record) {
    if (st.finishReason === 'exhausted' && route.value === 'game') navigate('play', { replace: true });
    return;
  }

  let flags: RecordFlags = { newBestClassic: false, newBestSprint: false, newBestStreak: false, newBestCategory: false };
  let newAchievements: AchievementId[] = [];
  let dailyOut: ResultSummary['daily'];

  updateSave((sv) => {
    const applied = applyRecord(sv.stats, record);
    flags = applied.flags;
    let daily = sv.daily;
    let official = false;
    if (record.mode === 'daily' && record.dateKey && !record.practice && !sv.daily[record.dateKey]) {
      official = true;
      daily = {
        ...sv.daily,
        [record.dateKey]: {
          dateKey: record.dateKey,
          collectionId: record.collectionId,
          score: record.score,
          total: record.answered,
          answers: st.history.map((q) => Boolean(q.correct)),
          completedAt: record.at,
          version: DAILY_ALGORITHM_VERSION,
        },
      };
    }
    const streak = dailyStreak(Object.keys(daily), todayKey());
    if (record.mode === 'daily') dailyOut = { official, streak, dateKey: record.dateKey! };
    newAchievements = newlyUnlocked({ stats: applied.stats, lastGame: record, dailyStreak: streak }, sv.achievements);
    const achievements = { ...sv.achievements };
    for (const id of newAchievements) achievements[id] = record.at;
    return {
      ...sv,
      stats: applied.stats,
      daily,
      achievements,
      recent: [record, ...sv.recent].slice(0, MAX_RECENT_GAMES),
    };
  });

  lastResult.value = {
    record,
    flags,
    info: s.info,
    history: st.history,
    finishReason: st.finishReason,
    newAchievements,
    ...(dailyOut ? { daily: dailyOut } : {}),
  };
  if (route.value === 'game') navigate('results', { replace: true });
}

/** Has today's official Daily Challenge been completed? */
export function todaysDaily() {
  return save.value.daily[todayKey()] ?? null;
}

// Test-only window hook: lets end-to-end tests read the hidden value to
// answer deterministically. Compiled out of production builds.
if (__E2E__ && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__updownly = {
    state: () => session.value?.state.value ?? null,
    expected: () => {
      const q = session.value?.state.value.current;
      if (!q) return null;
      return q.challenger.value > q.reference.value ? 'higher' : 'lower';
    },
  };
}
