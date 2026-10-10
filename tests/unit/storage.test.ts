import { describe, expect, it } from 'vitest';
import { applyRecord } from '../../src/game/scoring';
import {
  MAX_RECENT_GAMES,
  STORAGE_KEY,
  clearSave,
  defaultSave,
  loadSave,
  sanitizeSave,
  writeSave,
  type StorageLike,
} from '../../src/services/storage';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('storage', () => {
  it('round-trips scores and settings (survives reload)', () => {
    const s = memoryStorage();
    const save = defaultSave();
    save.settings.sound = false;
    save.settings.theme = 'dark';
    save.stats = applyRecord(save.stats, {
      id: '1',
      at: '2026-10-10T00:00:00Z',
      mode: 'classic',
      collectionId: 'geo-mountains',
      difficulty: 'hard',
      score: 14,
      answered: 15,
      bestStreak: 14,
    }).stats;
    expect(writeSave(s, save)).toBe(true);
    const loaded = loadSave(s);
    expect(loaded.settings.sound).toBe(false);
    expect(loaded.settings.theme).toBe('dark');
    expect(loaded.stats.bestClassic).toBe(14);
    expect(loaded.stats.bestByCategory['geo-mountains']).toEqual({ classic: 14, sprint: 0 });
  });

  it('returns defaults for corrupt JSON', () => {
    const s = memoryStorage();
    s.data.set(STORAGE_KEY, '{not json');
    expect(loadSave(s)).toEqual(defaultSave());
  });

  it('repairs invalid fields individually', () => {
    const repaired = sanitizeSave({
      settings: { sound: 'yes', theme: 'neon', defaultDifficulty: 'hard', categoryDifficulty: { a: 'easy', b: 'insane' } },
      stats: { bestClassic: -5, gamesPlayed: 3.7, correctAnswers: 50, questionsAnswered: 10, bestByCategory: { x: 'bad' } },
      daily: { 'not-a-date': {}, '2026-10-10': { collectionId: 'c', score: 7, answers: [true, 'x', false] } },
      recent: [{ id: 'ok', at: 'now', collectionId: 'c', mode: 'classic', score: 2 }, null, 42],
      achievements: { 'first-guess': '2026-10-10', bogus: 3 },
    });
    expect(repaired.settings.sound).toBe(true);
    expect(repaired.settings.theme).toBe('system');
    expect(repaired.settings.defaultDifficulty).toBe('hard');
    expect(repaired.settings.categoryDifficulty).toEqual({ a: 'easy' });
    expect(repaired.stats.bestClassic).toBe(0);
    expect(repaired.stats.gamesPlayed).toBe(3);
    expect(repaired.stats.correctAnswers).toBe(10);
    expect(repaired.stats.bestByCategory).toEqual({});
    expect(Object.keys(repaired.daily)).toEqual(['2026-10-10']);
    expect(repaired.daily['2026-10-10']!.answers).toEqual([true, false]);
    expect(repaired.recent).toHaveLength(1);
    expect(repaired.achievements).toEqual({ 'first-guess': '2026-10-10' });
  });

  it('handles non-object saves', () => {
    expect(sanitizeSave(null)).toEqual(defaultSave());
    expect(sanitizeSave([1, 2])).toEqual(defaultSave());
    expect(sanitizeSave('hello')).toEqual(defaultSave());
  });

  it('degrades gracefully when storage is unavailable or throws', () => {
    expect(loadSave(null)).toEqual(defaultSave());
    expect(loadSave(throwing)).toEqual(defaultSave());
    expect(writeSave(throwing, defaultSave())).toBe(false);
    expect(writeSave(null, defaultSave())).toBe(false);
    expect(clearSave(throwing)).toBe(false);
  });

  it('reset clears saved data', () => {
    const s = memoryStorage();
    writeSave(s, defaultSave());
    expect(clearSave(s)).toBe(true);
    expect(s.data.has(STORAGE_KEY)).toBe(false);
    expect(loadSave(s)).toEqual(defaultSave());
  });

  it('limits recent game history', () => {
    const recent = Array.from({ length: 50 }, (_, i) => ({ id: String(i), at: 'x', collectionId: 'c', mode: 'classic' }));
    expect(sanitizeSave({ recent }).recent).toHaveLength(MAX_RECENT_GAMES);
  });
});
