/**
 * Scoring and personal records. Pure functions over plain data so the
 * storage layer and the UI share one implementation.
 */
import type { Difficulty, GameState, Mode } from './types';

export type GameRecord = {
  id: string;
  /** ISO timestamp when the game finished. */
  at: string;
  mode: Mode;
  collectionId: string;
  difficulty: Difficulty;
  score: number;
  answered: number;
  bestStreak: number;
  /** Daily only. */
  dateKey?: string;
  practice?: boolean;
};

export type CategoryBest = { classic: number; sprint: number };

export type Stats = {
  gamesPlayed: number;
  questionsAnswered: number;
  correctAnswers: number;
  bestClassic: number;
  bestSprint: number;
  bestStreak: number;
  bestByCategory: Record<string, CategoryBest>;
  /** Collections with at least one finished game (for achievements). */
  collectionsPlayed: string[];
};

export const EMPTY_STATS: Stats = {
  gamesPlayed: 0,
  questionsAnswered: 0,
  correctAnswers: 0,
  bestClassic: 0,
  bestSprint: 0,
  bestStreak: 0,
  bestByCategory: {},
  collectionsPlayed: [],
};

export type RecordFlags = {
  newBestClassic: boolean;
  newBestSprint: boolean;
  newBestStreak: boolean;
  newBestCategory: boolean;
};

/** Accuracy as a fraction, or null when no question was answered. */
export function accuracy(correct: number, answered: number): number | null {
  return answered > 0 ? correct / answered : null;
}

/** Build the record for a finished game, or null if it must not count. */
export function recordFromState(state: GameState, now: Date = new Date()): GameRecord | null {
  if (state.phase !== 'finished' || state.finishReason === 'abandoned') return null;
  if (state.answered === 0) return null;
  const { config } = state;
  return {
    id: `${now.getTime().toString(36)}-${state.gameId}`,
    at: now.toISOString(),
    mode: config.mode,
    collectionId: config.collectionId,
    difficulty: config.difficulty,
    score: state.score,
    answered: state.answered,
    bestStreak: state.bestStreak,
    ...(config.mode === 'daily' ? { dateKey: config.dateKey, practice: Boolean(config.practice) } : {}),
  };
}

/**
 * Merge a finished game into the stats. Best scores only ever go up; a
 * daily practice run counts towards totals but sets no records.
 */
export function applyRecord(stats: Stats, rec: GameRecord): { stats: Stats; flags: RecordFlags } {
  const prevCat = stats.bestByCategory[rec.collectionId] ?? { classic: 0, sprint: 0 };
  const isClassic = rec.mode === 'classic';
  const isSprint = rec.mode === 'sprint';
  const flags: RecordFlags = {
    newBestClassic: isClassic && rec.score > stats.bestClassic,
    newBestSprint: isSprint && rec.score > stats.bestSprint,
    newBestStreak: rec.bestStreak > stats.bestStreak,
    newBestCategory:
      (isClassic && rec.score > prevCat.classic && prevCat.classic > 0) ||
      (isSprint && rec.score > prevCat.sprint && prevCat.sprint > 0),
  };
  const cat: CategoryBest = {
    classic: isClassic ? Math.max(prevCat.classic, rec.score) : prevCat.classic,
    sprint: isSprint ? Math.max(prevCat.sprint, rec.score) : prevCat.sprint,
  };
  return {
    flags,
    stats: {
      gamesPlayed: stats.gamesPlayed + 1,
      questionsAnswered: stats.questionsAnswered + rec.answered,
      correctAnswers: stats.correctAnswers + rec.score,
      bestClassic: isClassic ? Math.max(stats.bestClassic, rec.score) : stats.bestClassic,
      bestSprint: isSprint ? Math.max(stats.bestSprint, rec.score) : stats.bestSprint,
      bestStreak: Math.max(stats.bestStreak, rec.bestStreak),
      bestByCategory: { ...stats.bestByCategory, [rec.collectionId]: cat },
      collectionsPlayed: stats.collectionsPlayed.includes(rec.collectionId)
        ? stats.collectionsPlayed
        : [...stats.collectionsPlayed, rec.collectionId],
    },
  };
}

/** The collection with the highest Classic best (ties: most recent wins). */
export function bestCategory(stats: Stats): { collectionId: string; score: number } | null {
  let best: { collectionId: string; score: number } | null = null;
  for (const [collectionId, b] of Object.entries(stats.bestByCategory)) {
    if (b.classic > 0 && (!best || b.classic >= best.score)) best = { collectionId, score: b.classic };
  }
  return best;
}
