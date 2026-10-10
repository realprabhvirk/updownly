/**
 * Locally tracked achievements. Each unlocks only when its real condition
 * is met, and is celebrated exactly once.
 */
import type { Stats, GameRecord } from './scoring';

export type AchievementId =
  | 'first-guess'
  | 'five-correct'
  | 'ten-streak'
  | 'sprint-twenty'
  | 'perfect-daily'
  | 'daily-week'
  | 'category-explorer'
  | 'hundred-questions';

export type Achievement = { id: AchievementId; title: string; description: string; icon: string };

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-guess', title: 'First Guess', description: 'Get your first answer right.', icon: 'check' },
  { id: 'five-correct', title: 'Five Correct', description: 'Score 5 in a single game.', icon: 'hand-tap' },
  { id: 'ten-streak', title: 'Ten-Streak', description: 'Get 10 right in a row.', icon: 'lightning' },
  { id: 'sprint-twenty', title: 'Sprinter', description: 'Score 20 in a 60-second Sprint.', icon: 'timer' },
  { id: 'perfect-daily', title: 'Perfect Daily', description: 'Score 10/10 in a Daily Challenge.', icon: 'crown' },
  { id: 'daily-week', title: 'Seven Days', description: 'Finish the Daily Challenge 7 days in a row.', icon: 'calendar-check' },
  { id: 'category-explorer', title: 'Category Explorer', description: 'Finish games in 8 different categories.', icon: 'compass' },
  { id: 'hundred-questions', title: 'Hundred Questions', description: 'Answer 100 questions in total.', icon: 'medal' },
];

export type AchievementContext = {
  stats: Stats;
  lastGame: GameRecord;
  dailyStreak: number;
};

const RULES: Record<AchievementId, (c: AchievementContext) => boolean> = {
  'first-guess': (c) => c.stats.correctAnswers >= 1,
  'five-correct': (c) => c.lastGame.score >= 5,
  'ten-streak': (c) => c.stats.bestStreak >= 10,
  'sprint-twenty': (c) => c.lastGame.mode === 'sprint' && c.lastGame.score >= 20,
  'perfect-daily': (c) => c.lastGame.mode === 'daily' && !c.lastGame.practice && c.lastGame.score >= 10,
  'daily-week': (c) => c.dailyStreak >= 7,
  'category-explorer': (c) => c.stats.collectionsPlayed.length >= 8,
  'hundred-questions': (c) => c.stats.questionsAnswered >= 100,
};

/** Achievements newly met by this context that are not yet unlocked. */
export function newlyUnlocked(ctx: AchievementContext, unlocked: Record<string, string>): AchievementId[] {
  return ACHIEVEMENTS.filter((a) => !unlocked[a.id] && RULES[a.id](ctx)).map((a) => a.id);
}
