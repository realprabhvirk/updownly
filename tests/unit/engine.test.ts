import { describe, expect, it } from 'vitest';
import { CompetitiveClock } from '../../src/game/clock';
import { GameEngine, correctDirection } from '../../src/game/engine';
import { createRng } from '../../src/game/rng';
import type { Direction, GameConfig } from '../../src/game/types';
import { fakeTime, makeFacts, makePool } from './helpers';

const range = (n: number) => Array.from({ length: n }, (_, i) => (i + 1) * 10);
const classic: GameConfig = { mode: 'classic', collectionId: 'test', difficulty: 'normal' };
const sprint: GameConfig = { mode: 'sprint', collectionId: 'test', difficulty: 'normal' };
const daily: GameConfig = { mode: 'daily', collectionId: 'test', difficulty: 'normal', dateKey: '2026-10-10' };

function engine(config: GameConfig, values = range(200), seed = 1, clock?: CompetitiveClock) {
  return new GameEngine(makePool(values), config, { rng: createRng(seed), ...(clock ? { clock } : {}) });
}

const right = (e: GameEngine): Direction => correctDirection(e.getState().current!);
const wrong = (e: GameEngine): Direction => (right(e) === 'higher' ? 'lower' : 'higher');

describe('correctDirection', () => {
  const [a, b] = makeFacts([10, 20]);
  it('higher when the challenger is bigger', () => {
    expect(correctDirection({ reference: a!, challenger: b! })).toBe('higher');
  });
  it('lower when the challenger is smaller', () => {
    expect(correctDirection({ reference: b!, challenger: a! })).toBe('lower');
  });
});

describe('GameEngine — state machine', () => {
  it('starts in ready and moves to question', () => {
    const e = engine(classic);
    expect(e.getState().phase).toBe('ready');
    expect(e.start()).toBe(true);
    expect(e.getState().phase).toBe('question');
    expect(e.start()).toBe(false); // cannot start twice
  });

  it('scores a correct higher/lower answer once', () => {
    const e = engine(classic);
    e.start();
    const r = e.answer(right(e));
    expect(r?.correct).toBe(true);
    expect(e.getState().phase).toBe('revealing');
    expect(e.getState().score).toBe(1);
    expect(e.getState().streak).toBe(1);
    // Rapid repeated taps on the same question are ignored.
    expect(e.answer('higher')).toBeNull();
    expect(e.answer('lower')).toBeNull();
    expect(e.getState().score).toBe(1);
    expect(e.getState().answered).toBe(1);
  });

  it('registers an incorrect answer', () => {
    const e = engine(classic);
    e.start();
    const r = e.answer(wrong(e));
    expect(r?.correct).toBe(false);
    expect(e.getState().score).toBe(0);
    expect(e.getState().streak).toBe(0);
    e.completeReveal();
    expect(e.getState().phase).toBe('incorrect');
  });

  it('the revealed challenger becomes the next reference', () => {
    const e = engine(classic);
    e.start();
    const first = e.getState().current!;
    e.answer(right(e));
    e.completeReveal();
    e.next();
    expect(e.getState().current!.reference.id).toBe(first.challenger.id);
    expect(e.getState().current!.index).toBe(1);
  });

  it('classic ends after an incorrect answer', () => {
    const e = engine(classic);
    e.start();
    for (let i = 0; i < 5; i++) {
      e.answer(right(e));
      e.completeReveal();
      e.next();
    }
    e.answer(wrong(e));
    e.completeReveal();
    expect(e.next()).toBe(false);
    const s = e.getState();
    expect(s.phase).toBe('finished');
    expect(s.finishReason).toBe('wrong');
    expect(s.score).toBe(5);
    expect(s.bestStreak).toBe(5);
  });

  it('next() during revealing completes the reveal first', () => {
    const e = engine(classic);
    e.start();
    e.answer(right(e));
    expect(e.next()).toBe(true);
    expect(e.getState().phase).toBe('question');
  });

  it('ignores answers outside the question phase', () => {
    const e = engine(classic);
    expect(e.answer('higher')).toBeNull(); // ready
    e.start();
    e.answer(right(e));
    e.completeReveal();
    expect(e.answer('higher')).toBeNull(); // correct
    expect(e.getState().answered).toBe(1);
  });

  it('never asks a tied question', () => {
    const values = [...range(30), ...range(30), ...range(30)]; // heavy duplication
    const e = engine(classic, values, 3);
    e.start();
    for (let i = 0; i < 80 && e.getState().phase !== 'finished'; i++) {
      const q = e.getState().current!;
      expect(q.reference.value).not.toBe(q.challenger.value);
      e.answer(right(e));
      e.next();
    }
  });

  it('never compares a fact with itself or repeats a challenger back-to-back', () => {
    const e = engine(classic, range(50), 8);
    e.start();
    let prev = '';
    for (let i = 0; i < 49; i++) {
      const q = e.getState().current!;
      expect(q.reference.id).not.toBe(q.challenger.id);
      expect(q.challenger.id).not.toBe(prev);
      prev = q.challenger.id;
      e.answer(right(e));
      e.next();
    }
  });

  it('handles a small pool being exhausted without looping', () => {
    const e = engine(classic, [1, 2, 3, 4], 2);
    e.start();
    for (let i = 0; i < 50; i++) {
      expect(e.getState().phase).toBe('question');
      e.answer(right(e));
      e.next();
    }
    expect(e.recycleCount).toBeGreaterThan(0);
  });

  it('finishes as exhausted when no valid question exists', () => {
    const e = engine(classic, [5, 5, 5]);
    expect(e.start()).toBe(false);
    expect(e.getState().phase).toBe('finished');
    expect(e.getState().finishReason).toBe('exhausted');
  });

  it('abandon never counts as a result and freezes the game', () => {
    const e = engine(classic);
    e.start();
    e.answer(right(e));
    e.abandon();
    expect(e.getState().finishReason).toBe('abandoned');
    expect(e.next()).toBe(false);
    expect(e.answer('higher')).toBeNull();
  });

  it('notifies subscribers on every transition', () => {
    const e = engine(classic);
    const phases: string[] = [];
    e.subscribe((s) => phases.push(s.phase));
    e.start();
    e.answer(right(e));
    e.completeReveal();
    expect(phases).toEqual(['question', 'revealing', 'correct']);
  });

  it('game ids are unique so stale timers can be ignored', () => {
    expect(engine(classic).gameId).not.toBe(engine(classic).gameId);
  });
});

describe('GameEngine — Sprint', () => {
  it('continues after a wrong answer and finishes on time', () => {
    const t = fakeTime();
    const e = engine(sprint, range(400), 4, new CompetitiveClock(t.source));
    e.start();
    e.answer(wrong(e));
    e.completeReveal();
    expect(e.next()).toBe(true); // keeps going
    e.answer(right(e));
    e.next();
    expect(e.getState().score).toBe(1);
    expect(e.getState().answered).toBe(2);
    t.advance(59_000);
    e.tick();
    expect(e.getState().remainingMs).toBe(1_000);
    t.advance(1_000);
    expect(e.tick()).toBe(true);
    expect(e.getState().phase).toBe('finished');
    expect(e.getState().finishReason).toBe('time');
    expect(e.getState().remainingMs).toBe(0);
  });

  it('rejects answers after time runs out', () => {
    const t = fakeTime();
    const e = engine(sprint, range(400), 4, new CompetitiveClock(t.source));
    e.start();
    t.advance(60_001);
    expect(e.answer(right(e))).toBeNull();
    expect(e.getState().answered).toBe(0);
    expect(e.getState().phase).toBe('finished');
  });

  it('does not grant extra time while the tab is suspended', () => {
    const t = fakeTime();
    const e = engine(sprint, range(400), 4, new CompetitiveClock(t.source));
    e.start();
    t.advance(10_000);
    t.suspend(55_000); // monotonic clock paused, wall clock kept going
    expect(e.tick()).toBe(true);
  });

  it('does not grant extra time when the wall clock is moved back', () => {
    const t = fakeTime();
    const e = engine(sprint, range(400), 4, new CompetitiveClock(t.source));
    e.start();
    t.advance(30_000);
    t.rewindWall(3_600_000);
    e.tick();
    expect(e.getState().remainingMs).toBe(30_000);
  });

  it('clock starts only with the first question', () => {
    const t = fakeTime();
    const e = engine(sprint, range(400), 4, new CompetitiveClock(t.source));
    t.advance(120_000); // sitting on the ready screen costs nothing
    e.start();
    e.tick();
    expect(e.getState().remainingMs).toBe(60_000);
  });
});

describe('GameEngine — Daily', () => {
  it('has exactly ten questions and continues after wrong answers', () => {
    const pool = makePool(range(200));
    const sequence = [0, 50, 100, 150, 20, 70, 120, 170, 40, 90, 140];
    const e = new GameEngine(pool, daily, { rng: createRng(1), sequence });
    e.start();
    let asked = 0;
    while (e.getState().phase !== 'finished') {
      asked++;
      e.answer(asked % 3 === 0 ? wrong(e) : right(e));
      e.completeReveal();
      e.next();
    }
    expect(asked).toBe(10);
    expect(e.getState().answered).toBe(10);
    expect(e.getState().finishReason).toBe('complete');
    expect(e.getState().score).toBe(7);
  });

  it('follows the given sequence exactly', () => {
    const pool = makePool(range(200));
    const sequence = [5, 60, 10, 190, 3, 77, 150, 30, 99, 120, 1];
    const e = new GameEngine(pool, daily, { rng: createRng(99), sequence });
    e.start();
    const seen: string[] = [e.getState().current!.reference.id];
    while (e.getState().phase !== 'finished') {
      seen.push(e.getState().current!.challenger.id);
      e.answer('higher');
      e.next();
    }
    expect(seen).toEqual(sequence.map((i) => pool.facts[i]!.id));
  });
});
