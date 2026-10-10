/**
 * Local persistence. Everything lives in one versioned localStorage key.
 * Every access is wrapped: if storage is unavailable (private mode, quota,
 * blocked cookies) the app keeps working in memory for the session, and a
 * corrupt or partial save is repaired field by field rather than crashing.
 */
import type { AchievementId } from '../game/achievements';
import { EMPTY_STATS, type CategoryBest, type GameRecord, type Stats } from '../game/scoring';
import type { Difficulty } from '../game/types';

export const STORAGE_KEY = 'updownly:v1';
export const MAX_RECENT_GAMES = 20;
export const MAX_DAILY_RESULTS = 400;

export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'reduce' | 'full';
export type PlayMode = 'classic' | 'sprint';

export type Settings = {
  defaultMode: PlayMode;
  defaultDifficulty: Difficulty;
  sound: boolean;
  haptics: boolean;
  motion: MotionPref;
  theme: ThemePref;
  seenIntro: boolean;
  installHintDismissed: boolean;
  /** Last difficulty chosen per collection. */
  categoryDifficulty: Record<string, Difficulty>;
  /** Most recently played collections, newest first. */
  recentCollections: string[];
};

export type DailyResult = {
  dateKey: string;
  collectionId: string;
  score: number;
  total: number;
  answers: boolean[];
  completedAt: string;
  version: number;
};

export type SaveData = {
  version: 1;
  settings: Settings;
  stats: Stats;
  daily: Record<string, DailyResult>;
  achievements: Partial<Record<AchievementId, string>>;
  recent: GameRecord[];
};

export const DEFAULT_SETTINGS: Settings = {
  defaultMode: 'classic',
  defaultDifficulty: 'normal',
  sound: true,
  haptics: true,
  motion: 'system',
  theme: 'system',
  seenIntro: false,
  installHintDismissed: false,
  categoryDifficulty: {},
  recentCollections: [],
};

export function defaultSave(): SaveData {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, categoryDifficulty: {}, recentCollections: [] },
    stats: { ...EMPTY_STATS, bestByCategory: {}, collectionsPlayed: [] },
    daily: {},
    achievements: {},
    recent: [],
  };
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Resolve window.localStorage without throwing (Safari can throw on access). */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__updownly_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

// ── Sanitisers ─────────────────────────────────────────────────────────
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);
const DIFFS = ['easy', 'normal', 'hard'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {};
  const catDiff: Record<string, Difficulty> = {};
  if (isObj(s.categoryDifficulty)) {
    for (const [k, d] of Object.entries(s.categoryDifficulty)) if (DIFFS.includes(d as Difficulty)) catDiff[k] = d as Difficulty;
  }
  return {
    defaultMode: oneOf(s.defaultMode, ['classic', 'sprint'] as const, DEFAULT_SETTINGS.defaultMode),
    defaultDifficulty: oneOf(s.defaultDifficulty, DIFFS, DEFAULT_SETTINGS.defaultDifficulty),
    sound: bool(s.sound, DEFAULT_SETTINGS.sound),
    haptics: bool(s.haptics, DEFAULT_SETTINGS.haptics),
    motion: oneOf(s.motion, ['system', 'reduce', 'full'] as const, 'system'),
    theme: oneOf(s.theme, ['system', 'light', 'dark'] as const, 'system'),
    seenIntro: bool(s.seenIntro, false),
    installHintDismissed: bool(s.installHintDismissed, false),
    categoryDifficulty: catDiff,
    recentCollections: Array.isArray(s.recentCollections)
      ? s.recentCollections.filter((x): x is string => typeof x === 'string').slice(0, 6)
      : [],
  };
}

function sanitizeStats(v: unknown): Stats {
  const s = isObj(v) ? v : {};
  const byCat: Record<string, CategoryBest> = {};
  if (isObj(s.bestByCategory)) {
    for (const [k, b] of Object.entries(s.bestByCategory)) {
      if (isObj(b)) byCat[k] = { classic: num(b.classic), sprint: num(b.sprint) };
    }
  }
  const stats: Stats = {
    gamesPlayed: num(s.gamesPlayed),
    questionsAnswered: num(s.questionsAnswered),
    correctAnswers: num(s.correctAnswers),
    bestClassic: num(s.bestClassic),
    bestSprint: num(s.bestSprint),
    bestStreak: num(s.bestStreak),
    bestByCategory: byCat,
    collectionsPlayed: Array.isArray(s.collectionsPlayed)
      ? [...new Set(s.collectionsPlayed.filter((x): x is string => typeof x === 'string'))]
      : [],
  };
  // Correct answers can never exceed questions answered.
  stats.correctAnswers = Math.min(stats.correctAnswers, stats.questionsAnswered);
  return stats;
}

function sanitizeRecord(v: unknown): GameRecord | null {
  if (!isObj(v)) return null;
  const mode = oneOf(v.mode, ['classic', 'sprint', 'daily'] as const, 'classic');
  if (typeof v.id !== 'string' || typeof v.at !== 'string' || typeof v.collectionId !== 'string') return null;
  return {
    id: v.id,
    at: v.at,
    mode,
    collectionId: v.collectionId,
    difficulty: oneOf(v.difficulty, DIFFS, 'normal'),
    score: num(v.score),
    answered: num(v.answered),
    bestStreak: num(v.bestStreak),
    ...(typeof v.dateKey === 'string' && DATE.test(v.dateKey) ? { dateKey: v.dateKey } : {}),
    ...(v.practice === true ? { practice: true } : {}),
  };
}

function sanitizeDaily(v: unknown): Record<string, DailyResult> {
  const out: Record<string, DailyResult> = {};
  if (!isObj(v)) return out;
  const keys = Object.keys(v).filter((k) => DATE.test(k)).sort().slice(-MAX_DAILY_RESULTS);
  for (const k of keys) {
    const r = v[k];
    if (!isObj(r) || typeof r.collectionId !== 'string') continue;
    const answers = Array.isArray(r.answers) ? r.answers.filter((x): x is boolean => typeof x === 'boolean') : [];
    out[k] = {
      dateKey: k,
      collectionId: r.collectionId,
      score: num(r.score),
      total: num(r.total, 10) || 10,
      answers,
      completedAt: typeof r.completedAt === 'string' ? r.completedAt : '',
      version: num(r.version, 1),
    };
  }
  return out;
}

export function sanitizeSave(raw: unknown): SaveData {
  const v = isObj(raw) ? raw : {};
  const achievements: SaveData['achievements'] = {};
  if (isObj(v.achievements)) {
    for (const [k, at] of Object.entries(v.achievements)) if (typeof at === 'string') achievements[k as AchievementId] = at;
  }
  return {
    version: 1,
    settings: sanitizeSettings(v.settings),
    stats: sanitizeStats(v.stats),
    daily: sanitizeDaily(v.daily),
    achievements,
    recent: Array.isArray(v.recent)
      ? v.recent.map(sanitizeRecord).filter((r): r is GameRecord => r !== null).slice(0, MAX_RECENT_GAMES)
      : [],
  };
}

export function loadSave(storage: StorageLike | null): SaveData {
  if (!storage) return defaultSave();
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return defaultSave();
    return sanitizeSave(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

/** Returns false if the write failed (the in-memory state still updates). */
export function writeSave(storage: StorageLike | null, data: SaveData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
