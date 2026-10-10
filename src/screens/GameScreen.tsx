import { useEffect, useRef, useState } from 'preact/hooks';
import { announce } from '../app/announce';
import { abandonGame, loadingCollection, session, type Session } from '../app/game';
import { navigate } from '../app/router';
import { openFactId, save, settings, updateSettings } from '../app/store';
import { AnswerButtons } from '../components/AnswerButtons';
import { ConfirmDialog } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { FactCard } from '../components/FactCard';
import { Icon } from '../components/Icon';
import type { CollectionInfo } from '../data/catalog';
import { formatInline } from '../data/format';
import { DIFFICULTY_LABEL, MODE_LABEL } from '../design/strings';
import { correctDirection } from '../game/engine';
import type { Direction, GameState } from '../game/types';
import { sounds } from '../services/audio';
import { haptic } from '../services/haptics';

const REVEAL_MS = 520;
const SPRINT_NEXT_CORRECT_MS = 700;
const SPRINT_NEXT_WRONG_MS = 1100;

export function GameScreen() {
  const s = session.value;
  useEffect(() => {
    // Nothing to show (e.g. after a reload): go back to Play.
    if (!s && !loadingCollection.value) navigate('play', { replace: true });
  }, [s]);
  if (!s) {
    return (
      <div class="game game-loading" aria-busy="true">
        <p>Loading…</p>
      </div>
    );
  }
  return <ActiveGame s={s} key={s.engine.gameId} />;
}

function ReadyView({ s }: { s: Session }) {
  const { info } = s;
  const st = s.state.value;
  const firstGame = !settings.value.seenIntro;
  const practice = st.config.mode === 'daily' && st.config.practice;
  const begin = () => {
    sounds.unlock();
    if (firstGame) updateSettings({ seenIntro: true });
    s.engine.start();
  };
  return (
    <div class="ready" style={{ '--cat': info.group.colour }}>
      <div class="ready-top">
        <button type="button" class="icon-btn" aria-label="Back" onClick={() => (abandonGame(), navigate('play'))}>
          <Icon name="x" size={22} />
        </button>
      </div>
      <div class="ready-card">
        <svg class="ready-art" viewBox="140 190 744 644" aria-hidden="true">
          <path d="M352 200 L552 440 L432 440 L432 660 L272 660 L272 440 L152 440 Z" fill="currentColor" />
          <path d="M672 824 L472 584 L592 584 L592 364 L752 364 L752 584 L872 584 Z" fill="currentColor" />
        </svg>
        <span class="ready-icon" aria-hidden="true">
          <Icon name={info.icon} size={40} />
        </span>
        <p class="ready-mode">{MODE_LABEL[st.config.mode]}</p>
        <h1 class="ready-title">
          {info.title}
          <span>{info.subtitle}</span>
        </h1>
        <p class="ready-meta">
          {st.config.mode === 'daily' ? '10 questions' : DIFFICULTY_LABEL[st.config.difficulty]} ·{' '}
          {info.count.toLocaleString('en-GB')} facts · {info.periodLabel}
        </p>
      </div>
      {firstGame && (
        <div class="intro">
          <p>
            <strong>How to play.</strong> You see one fact with its number. Is the next one{' '}
            <strong>higher</strong> or <strong>lower</strong>?
          </p>
          <p>
            {st.config.mode === 'classic' && 'Keep going until you miss one.'}
            {st.config.mode === 'sprint' && 'Answer as many as you can in 60 seconds. Misses don’t end the run.'}
            {st.config.mode === 'daily' && 'Ten questions, the same for everyone today.'}
          </p>
        </div>
      )}
      {st.config.mode === 'sprint' && !firstGame && <p class="ready-note">The clock starts with the first question.</p>}
      {practice && (
        <p class="ready-note">
          You’ve already played today’s challenge. This is a practice run — your official result stays as it is.
        </p>
      )}
      <div class="ready-actions">
        <Button variant="strong" size="l" block icon="play" onClick={begin} data-autofocus data-testid="ready-start">
          Start
        </Button>
      </div>
    </div>
  );
}

function ScoreBox({ st }: { st: GameState }) {
  if (st.config.mode === 'daily') {
    return (
      <div class="scorebox" aria-label={`Question ${Math.min(st.answered + 1, 10)} of 10. Score ${st.score}.`}>
        <span class="scorebox-label">Score</span>
        <span class="scorebox-value tabular" data-testid="score">
          {st.score}
          <small>/10</small>
        </span>
      </div>
    );
  }
  return (
    <div class="scorebox" aria-label={`Score ${st.score}`}>
      <span class="scorebox-label">Score</span>
      <span class="scorebox-value tabular" data-testid="score">
        {st.score}
      </span>
    </div>
  );
}

function SprintTimer({ ms }: { ms: number }) {
  const secs = Math.ceil(ms / 1000);
  const urgent = secs <= 10;
  return (
    <div class={`timer${urgent ? ' is-urgent' : ''}`} role="timer" aria-label={`${secs} seconds left`}>
      <div class="timer-track" aria-hidden="true">
        <div class="timer-fill" style={{ transform: `scaleX(${Math.max(0, ms / 60000)})` }} />
      </div>
      <span class="timer-text tabular" aria-hidden="true">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
      </span>
    </div>
  );
}

function DailyProgress({ st }: { st: GameState }) {
  return (
    <ol class="dots" aria-label={`Question ${Math.min(st.answered + 1, 10)} of 10`}>
      {Array.from({ length: 10 }, (_, i) => {
        const q = st.history[i];
        const cls = q ? (q.correct ? 'is-right' : 'is-wrong') : i === st.answered ? 'is-current' : '';
        return <li class={`dot ${cls}`} aria-hidden="true" />;
      })}
    </ol>
  );
}

function ActiveGame({ s }: { s: Session }) {
  const st = s.state.value;
  const { info, engine } = s;
  const metric = info.metric;
  const [confirmExit, setConfirmExit] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const higherRef = useRef<HTMLDivElement>(null);
  const q = st.current;
  const revealed = st.phase === 'revealing' || st.phase === 'correct' || st.phase === 'incorrect';

  // Reveal → settle, and Sprint auto-advance. Each timer is bound to the
  // game and question it was created for, so a stale timer is a no-op.
  useEffect(() => {
    if (!q) return;
    const gameId = st.gameId;
    const index = q.index;
    const timers: number[] = [];
    const still = () => {
      const now = engine.getState();
      return now.gameId === gameId && now.current?.index === index;
    };
    if (st.phase === 'revealing') {
      timers.push(window.setTimeout(() => still() && engine.completeReveal(), REVEAL_MS));
    }
    if (st.config.mode === 'sprint' && (st.phase === 'correct' || st.phase === 'incorrect')) {
      const wait = (st.phase === 'correct' ? SPRINT_NEXT_CORRECT_MS : SPRINT_NEXT_WRONG_MS) - REVEAL_MS;
      timers.push(window.setTimeout(() => still() && engine.next(), Math.max(120, wait)));
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [st.phase, q?.index, st.gameId]);

  // Focus management for keyboard and screen-reader users.
  useEffect(() => {
    if (st.phase === 'correct' || st.phase === 'incorrect') continueRef.current?.focus({ preventScroll: true });
    if (st.phase === 'question') higherRef.current?.querySelector<HTMLButtonElement>('.answer-higher')?.focus({ preventScroll: true });
  }, [st.phase]);

  const answer = (d: Direction) => {
    const result = engine.answer(d);
    if (!result) return;
    const sv = save.value.settings;
    if (sv.sound) (result.correct ? sounds.correct : sounds.incorrect)();
    if (sv.haptics) haptic(result.correct ? 'success' : 'error');
    const qq = result.question;
    announce(
      `${result.correct ? 'Correct' : 'Not quite'}. ${qq.challenger.entityName}: ${formatInline(qq.challenger.value, metric)}. ` +
        `${result.expected === 'higher' ? 'Higher' : 'Lower'} than ${qq.reference.entityName}.`,
    );
  };

  const next = () => {
    sounds.unlock();
    engine.next();
  };

  // Keyboard: ↑/H higher, ↓/L lower, Enter/Space continue, Esc exit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || confirmExit || openFactId.value || e.metaKey || e.ctrlKey || e.altKey) return;
      const phase = engine.getState().phase;
      const k = e.key.toLowerCase();
      if (phase === 'question' && (k === 'arrowup' || k === 'h')) {
        e.preventDefault();
        answer('higher');
      } else if (phase === 'question' && (k === 'arrowdown' || k === 'l')) {
        e.preventDefault();
        answer('lower');
      } else if ((phase === 'correct' || phase === 'incorrect' || phase === 'revealing') && (k === 'enter' || k === ' ')) {
        if (document.activeElement instanceof HTMLButtonElement && document.activeElement !== continueRef.current) return;
        e.preventDefault();
        next();
      } else if (k === 'escape') {
        e.preventDefault();
        setConfirmExit(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmExit]);

  if (st.phase === 'ready') return <ReadyView s={s} />;
  if (!q) return null;

  const expected = correctDirection(q);
  const isLastClassic = st.config.mode === 'classic' && st.phase !== 'question' && q.correct === false;
  const isLastDaily = st.config.mode === 'daily' && st.answered >= 10 && revealed;
  const continueLabel = isLastClassic || isLastDaily ? 'See results' : 'Next';

  return (
    <div
      class={`game phase-${st.phase} game-${st.config.mode}`}
      style={{ '--cat': info.group.colour }}
      data-testid="game"
      data-correct={revealed ? String(Boolean(q.correct)) : undefined}
    >
      <header class="game-top">
        <button type="button" class="icon-btn" aria-label="End game" onClick={() => setConfirmExit(true)} data-testid="exit-game">
          <Icon name="x" size={22} />
        </button>
        <div class="game-cat">
          <span class="game-cat-icon" aria-hidden="true">
            <Icon name={info.icon} size={16} />
          </span>
          <span class="game-cat-text">
            <strong>{info.title}</strong> {info.subtitle}
          </span>
        </div>
        <ScoreBox st={st} />
      </header>
      {st.config.mode === 'sprint' && st.remainingMs !== null && <SprintTimer ms={st.remainingMs} />}
      {st.config.mode === 'daily' && <DailyProgress st={st} />}
      {st.config.mode === 'classic' && st.streak >= 3 && st.phase === 'question' && (
        <p class="streak-banner" aria-hidden="true">
          <Icon name="lightning" size={14} /> {st.streak} in a row
        </p>
      )}

      <div class="board" key={q.index}>
        <FactCard
          fact={q.reference}
          metric={metric}
          role="reference"
          colour={info.group.colour}
          onInfo={(f) => (openFactId.value = f.id)}
          footer={<span class="fact-label">{metric.label} · {q.reference.periodLabel}</span>}
        />
        <div class="versus" aria-hidden="true">
          <span>vs</span>
        </div>
        <FactCard
          fact={q.challenger}
          metric={metric}
          role="challenger"
          revealed={revealed}
          animate={revealed}
          outcome={revealed ? (q.correct ? 'correct' : 'incorrect') : undefined}
          onInfo={(f) => (openFactId.value = f.id)}
          footer={
            revealed ? (
              <span class="fact-label">{metric.label} · {q.challenger.periodLabel}</span>
            ) : (
              <span class="fact-prompt">
                Higher or lower than <strong>{q.reference.entityName}</strong>?
              </span>
            )
          }
        />
      </div>

      <div class="game-bottom" ref={higherRef}>
        {st.phase === 'question' ? (
          <AnswerButtons onAnswer={answer} higherWord={metric.higherWord} lowerWord={metric.lowerWord} />
        ) : (
          <>
          <Verdict correct={Boolean(q.correct)} expected={expected} info={info} />
          <button
            type="button"
            ref={continueRef}
            class={`continue${q.correct ? ' is-correct' : ' is-incorrect'}`}
            onClick={next}
            data-testid="continue"
          >
            <span>{continueLabel}</span>
            <Icon name="arrow-right" size={22} />
          </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmExit}
        title="End this game?"
        message={
          st.config.mode === 'daily' && !st.config.practice
            ? 'Your Daily Challenge won’t be saved, and you can start it again later.'
            : 'This round won’t count towards your stats or records.'
        }
        confirmLabel="End game"
        cancelLabel="Keep playing"
        destructive
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          abandonGame();
          navigate('play', { replace: true });
        }}
      />
    </div>
  );
}

function Verdict({ correct, expected, info }: { correct: boolean; expected: Direction; info: CollectionInfo }) {
  const word = expected === 'higher' ? info.metric.higherWord : info.metric.lowerWord;
  return (
    <span class={`verdict ${correct ? 'is-correct' : 'is-incorrect'}`} data-testid="verdict" data-correct={correct}>
      <Icon name={correct ? 'check-circle' : 'x-circle'} size={20} />
      <strong>{correct ? 'Correct' : 'Not quite'}</strong>
      <span>
        — it’s {expected === 'higher' ? 'higher' : 'lower'}
        {word !== expected ? ` (${word})` : ''}
      </span>
    </span>
  );
}
