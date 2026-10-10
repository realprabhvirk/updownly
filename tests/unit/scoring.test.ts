import { describe, expect, it } from 'vitest';
import { newlyUnlocked } from '../../src/game/achievements';
import { EMPTY_STATS, accuracy, applyRecord, bestCategory, recordFromState, type GameRecord } from '../../src/game/scoring';
import type { GameState } from '../../src/game/types';

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  id: 'x',
  at: '2026-10-10T10:00:00.000Z',
  mode: 'classic',
  collectionId: 'geo-mountains',
  difficulty: 'normal',
  score: 5,
  answered: 6,
  bestStreak: 5,
  ...over,
});

const finished = (over: Partial<GameState> = {}): GameState => ({
  gameId: 1,
  config: { mode: 'classic', collectionId: 'c', difficulty: 'normal' },
  phase: 'finished',
  current: null,
  history: [],
  score: 3,
  answered: 4,
  streak: 0,
  bestStreak: 3,
  remainingMs: null,
  totalQuestions: null,
  finishReason: 'wrong',
  ...over,
});

describe('scoring', () => {
  it('accuracy is null without answers', () => {
    expect(accuracy(0, 0)).toBeNull();
    expect(accuracy(3, 4)).toBe(0.75);
  });

  it('records finished games but not abandoned or empty ones', () => {
    expect(recordFromState(finished())?.score).toBe(3);
    expect(recordFromState(finished({ finishReason: 'abandoned' }))).toBeNull();
    expect(recordFromState(finished({ answered: 0, score: 0 }))).toBeNull();
    expect(recordFromState(finished({ phase: 'question' }))).toBeNull();
  });

  it('updates totals and bests', () => {
    const { stats, flags } = applyRecord(EMPTY_STATS, rec());
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.questionsAnswered).toBe(6);
    expect(stats.correctAnswers).toBe(5);
    expect(stats.bestClassic).toBe(5);
    expect(stats.bestStreak).toBe(5);
    expect(stats.bestByCategory['geo-mountains']).toEqual({ classic: 5, sprint: 0 });
    expect(flags.newBestClassic).toBe(true);
  });

  it('best scores never decrease', () => {
    let s = applyRecord(EMPTY_STATS, rec({ score: 12, bestStreak: 12 })).stats;
    const r = applyRecord(s, rec({ score: 3, bestStreak: 3 }));
    s = r.stats;
    expect(s.bestClassic).toBe(12);
    expect(s.bestStreak).toBe(12);
    expect(s.bestByCategory['geo-mountains']!.classic).toBe(12);
    expect(r.flags.newBestClassic).toBe(false);
  });

  it('sprint scores are tracked separately from classic', () => {
    const s = applyRecord(EMPTY_STATS, rec({ mode: 'sprint', score: 20, bestStreak: 6 })).stats;
    expect(s.bestSprint).toBe(20);
    expect(s.bestClassic).toBe(0);
  });

  it('finds the best category', () => {
    let s = applyRecord(EMPTY_STATS, rec({ collectionId: 'a', score: 4 })).stats;
    s = applyRecord(s, rec({ collectionId: 'b', score: 9 })).stats;
    expect(bestCategory(s)).toEqual({ collectionId: 'b', score: 9 });
    expect(bestCategory(EMPTY_STATS)).toBeNull();
  });
});

describe('achievements', () => {
  it('unlocks only when conditions are met, and only once', () => {
    const { stats } = applyRecord(EMPTY_STATS, rec({ score: 5, bestStreak: 5, answered: 6 }));
    const ids = newlyUnlocked({ stats, lastGame: rec(), dailyStreak: 0 }, {});
    expect(ids).toContain('first-guess');
    expect(ids).toContain('five-correct');
    expect(ids).not.toContain('ten-streak');
    expect(ids).not.toContain('hundred-questions');
    const again = newlyUnlocked({ stats, lastGame: rec(), dailyStreak: 0 }, { 'first-guess': 'x', 'five-correct': 'x' });
    expect(again).toEqual([]);
  });

  it('perfect daily ignores practice runs', () => {
    const daily = rec({ mode: 'daily', score: 10, answered: 10, practice: true });
    const { stats } = applyRecord(EMPTY_STATS, daily);
    expect(newlyUnlocked({ stats, lastGame: daily, dailyStreak: 1 }, {})).not.toContain('perfect-daily');
    const official = { ...daily, practice: false };
    expect(newlyUnlocked({ stats, lastGame: official, dailyStreak: 1 }, {})).toContain('perfect-daily');
  });
});
