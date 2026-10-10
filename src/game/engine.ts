/**
 * The game engine: an explicit state machine with no knowledge of the UI.
 *
 *   ready ──start──▶ question ──answer──▶ revealing ──completeReveal──▶ correct | incorrect
 *                       ▲                                                      │
 *                       └──────────────────────── next ◀───────────────────────┘
 *   any phase ──(classic wrong / daily complete / sprint time / abandon)──▶ finished
 *
 * Every transition validates the current phase, so a second tap, a stale
 * timer or an out-of-order call is a harmless no-op. Scoring happens in
 * exactly one place (`answer`), once per question.
 */
import { CompetitiveClock } from './clock';
import { ChallengerQueue, type Pool } from './queue';
import type { Rng } from './rng';
import {
  DAILY_QUESTIONS,
  SPRINT_DURATION_MS,
  type Direction,
  type FinishReason,
  type GameConfig,
  type GameState,
  type Question,
} from './types';

let nextGameId = 1;

export type AnswerResult = { correct: boolean; expected: Direction; question: Question };

export type EngineOptions = {
  rng: Rng;
  clock?: CompetitiveClock;
  /** Daily: pool indices [reference, challenger1, …]. Overrides the queue. */
  sequence?: number[];
};

export function correctDirection(q: Pick<Question, 'reference' | 'challenger'>): Direction {
  return q.challenger.value > q.reference.value ? 'higher' : 'lower';
}

export class GameEngine {
  readonly gameId = nextGameId++;
  private readonly queue: ChallengerQueue;
  private readonly clock: CompetitiveClock;
  private readonly sequence: number[] | null;
  private state: GameState;
  private refIndex = -1;
  private challengerIndex = -1;
  private listeners = new Set<(s: GameState) => void>();

  constructor(
    private readonly pool: Pool,
    readonly config: GameConfig,
    opts: EngineOptions,
  ) {
    this.queue = new ChallengerQueue(pool, opts.rng);
    this.clock = opts.clock ?? new CompetitiveClock();
    this.sequence = opts.sequence ?? null;
    this.state = Object.freeze({
      gameId: this.gameId,
      config,
      phase: 'ready',
      current: null,
      history: [],
      score: 0,
      answered: 0,
      streak: 0,
      bestStreak: 0,
      remainingMs: config.mode === 'sprint' ? SPRINT_DURATION_MS : null,
      totalQuestions: config.mode === 'daily' ? DAILY_QUESTIONS : null,
      finishReason: null,
    }) as GameState;
  }

  getState(): GameState {
    return this.state;
  }

  subscribe(fn: (s: GameState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<GameState>): void {
    this.state = Object.freeze({ ...this.state, ...patch });
    for (const fn of this.listeners) fn(this.state);
  }

  private makeQuestion(index: number): Question {
    return {
      index,
      reference: this.pool.facts[this.refIndex]!,
      challenger: this.pool.facts[this.challengerIndex]!,
    };
  }

  /** ready → question. Sprint's clock starts with the first question. */
  start(): boolean {
    if (this.state.phase !== 'ready') return false;
    if (this.sequence) {
      if (this.sequence.length < 2) return this.finish('exhausted'), false;
      this.refIndex = this.sequence[0]!;
      this.challengerIndex = this.sequence[1]!;
    } else {
      const start = this.queue.pickStart(this.config.difficulty);
      if (start === null) return this.finish('exhausted'), false;
      this.refIndex = start;
      const c = this.queue.next(start, this.config.difficulty);
      if (c === null) return this.finish('exhausted'), false;
      this.challengerIndex = c;
    }
    if (this.config.mode === 'sprint') this.clock.start();
    this.set({ phase: 'question', current: this.makeQuestion(0) });
    return true;
  }

  /**
   * question → revealing. Returns null if the answer is not accepted
   * (wrong phase, already answered, or Sprint time has run out).
   */
  answer(direction: Direction): AnswerResult | null {
    if (this.state.phase !== 'question' || !this.state.current) return null;
    if (this.tick()) return null; // time ran out before the tap landed
    const q = this.state.current;
    if (q.answer !== undefined) return null;
    const expected = correctDirection(q);
    const correct = direction === expected;
    const answered: Question = { ...q, answer: direction, correct };
    const streak = correct ? this.state.streak + 1 : 0;
    this.set({
      phase: 'revealing',
      current: answered,
      history: [...this.state.history, answered],
      answered: this.state.answered + 1,
      score: this.state.score + (correct ? 1 : 0),
      streak,
      bestStreak: Math.max(this.state.bestStreak, streak),
    });
    return { correct, expected, question: answered };
  }

  /** revealing → correct | incorrect. */
  completeReveal(): boolean {
    if (this.state.phase !== 'revealing' || !this.state.current) return false;
    this.set({ phase: this.state.current.correct ? 'correct' : 'incorrect' });
    return true;
  }

  /** correct | incorrect → question, or finished. */
  next(): boolean {
    const { current, config } = this.state;
    if (this.state.phase === 'revealing') this.completeReveal();
    if (this.state.phase !== 'correct' && this.state.phase !== 'incorrect') return false;
    if (this.tick()) return false;
    if (config.mode === 'classic' && !current?.correct) return this.finish('wrong'), false;
    if (config.mode === 'daily' && this.state.answered >= DAILY_QUESTIONS) return this.finish('complete'), false;

    // The revealed challenger becomes the new reference.
    const index = (current?.index ?? 0) + 1;
    this.refIndex = this.challengerIndex;
    let c: number | null;
    if (this.sequence) {
      c = this.sequence[index + 1] ?? null;
    } else {
      c = this.queue.next(this.refIndex, config.difficulty);
    }
    if (c === null) return this.finish(config.mode === 'daily' ? 'complete' : 'exhausted'), false;
    this.challengerIndex = c;
    this.set({ phase: 'question', current: this.makeQuestion(index) });
    return true;
  }

  /**
   * Sprint: refresh remaining time; finishes the game when it hits zero.
   * Returns true if the game is (now) finished because time ran out.
   */
  tick(): boolean {
    if (this.config.mode !== 'sprint' || !this.clock.isStarted) return false;
    if (this.state.phase === 'finished') return this.state.finishReason === 'time';
    const remaining = Math.max(0, SPRINT_DURATION_MS - this.clock.elapsed());
    if (remaining <= 0) {
      this.finish('time');
      return true;
    }
    if (remaining !== this.state.remainingMs) this.set({ remainingMs: remaining });
    return false;
  }

  /** Leave early. Abandoned games never produce records. */
  abandon(): void {
    if (this.state.phase !== 'finished') this.finish('abandoned');
  }

  private finish(reason: FinishReason): void {
    if (this.state.phase === 'finished') return;
    this.set({
      phase: 'finished',
      finishReason: reason,
      remainingMs: this.config.mode === 'sprint' ? (reason === 'time' ? 0 : this.state.remainingMs) : null,
    });
  }

  /** Test/diagnostic helper: how often the pool has been recycled. */
  get recycleCount(): number {
    return this.queue.recycleCount;
  }
}
