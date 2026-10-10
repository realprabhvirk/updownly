import type { Fact } from '../data/schema';

export type Mode = 'classic' | 'sprint' | 'daily';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Direction = 'higher' | 'lower';

/** Explicit game phases. See engine.ts for the allowed transitions. */
export type Phase = 'idle' | 'ready' | 'question' | 'revealing' | 'correct' | 'incorrect' | 'finished';

export type FinishReason = 'wrong' | 'time' | 'complete' | 'exhausted' | 'abandoned';

export type Question = {
  index: number;
  reference: Fact;
  challenger: Fact;
  answer?: Direction;
  correct?: boolean;
};

export type GameConfig = {
  mode: Mode;
  collectionId: string;
  difficulty: Difficulty;
  /** Daily only: local calendar date YYYY-MM-DD. */
  dateKey?: string;
  /** Daily only: a replay that never overwrites the official result. */
  practice?: boolean;
};

export type GameState = {
  /** Unique per game instance; guards against stale timers. */
  gameId: number;
  config: GameConfig;
  phase: Phase;
  current: Question | null;
  history: Question[];
  score: number;
  answered: number;
  streak: number;
  bestStreak: number;
  /** Sprint: milliseconds remaining (null for other modes). */
  remainingMs: number | null;
  /** Daily: total questions in the challenge. */
  totalQuestions: number | null;
  finishReason: FinishReason | null;
};

export const SPRINT_DURATION_MS = 60_000;
export const DAILY_QUESTIONS = 10;
