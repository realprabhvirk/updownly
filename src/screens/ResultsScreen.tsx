import { useEffect } from 'preact/hooks';
import { lastResult, startGame, todayKey } from '../app/game';
import { navigate } from '../app/router';
import { save, showToast } from '../app/store';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { ACHIEVEMENTS } from '../game/achievements';
import { accuracy } from '../game/scoring';
import { DIFFICULTY_LABEL, MODE_LABEL } from '../design/strings';
import { sounds } from '../services/audio';
import { shareText } from '../services/share';
import { focusCategories } from './PlayScreen';

function appUrl(): string {
  return `${location.origin}${location.pathname}`;
}

function prettyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ResultsScreen() {
  const r = lastResult.value;
  useEffect(() => {
    if (!r) navigate('play', { replace: true });
  }, [r]);
  const isRecord = Boolean(r && (r.flags.newBestClassic || r.flags.newBestSprint));
  useEffect(() => {
    if (r && isRecord && save.value.settings.sound) sounds.record();
  }, [r?.record.id]);
  if (!r) return null;

  const { record, info, flags } = r;
  const acc = accuracy(record.score, record.answered);
  const isDaily = record.mode === 'daily';
  const pattern = r.history.map((q) => (q.correct ? '✓' : '✗')).join('');

  const share = async () => {
    const title = `${info.title} (${info.subtitle})`;
    const lines =
      record.mode === 'daily'
        ? [`UPDOWNLY Daily · ${prettyDate(record.dateKey ?? todayKey())} · ${title}`, `${record.score}/10 ${pattern}`]
        : record.mode === 'sprint'
          ? [`UPDOWNLY · 60-Second Sprint · ${title}`, `${record.score} correct in 60 seconds.`]
          : [`UPDOWNLY · ${title} · ${DIFFICULTY_LABEL[record.difficulty]}`, `${record.score} in a row. Higher or lower — how far can you go?`];
    const outcome = await shareText([...lines, appUrl()].join('\n'));
    if (outcome === 'copied') showToast('Result copied to clipboard');
    if (outcome === 'failed') showToast('Sharing isn’t available here');
  };

  const again = () =>
    startGame({
      collectionId: info.id,
      mode: record.mode,
      difficulty: record.difficulty,
      practice: isDaily ? true : undefined,
      autoStart: !isDaily,
    });

  const caption = isDaily ? 'out of 10' : record.score === 1 ? 'correct answer' : 'correct answers';
  const endNote =
    r.finishReason === 'time'
      ? 'Time’s up.'
      : r.finishReason === 'exhausted'
        ? 'You’ve seen every comparison in this category.'
        : record.mode === 'classic'
          ? 'One miss ends the run.'
          : null;

  return (
    <div class={`results${isRecord ? ' is-record' : ''}`} style={{ '--cat': info.group.colour }} data-testid="results">
      <header class="results-hero">
        <div class="results-top">
          <button type="button" class="icon-btn" aria-label="Back to Play" onClick={() => navigate('play')}>
            <Icon name="x" size={22} />
          </button>
        </div>
        <p class="results-eyebrow">
          {MODE_LABEL[record.mode]}
          {record.practice ? ' · Practice' : ''}
        </p>
        <h1 class="results-cat">
          {info.title} <span>{info.subtitle}</span>
        </h1>
        <p class="results-score tabular" data-testid="final-score">
          {record.score}
        </p>
        <p class="results-caption">{caption}</p>
        {isRecord && (
          <p class="record-badge" role="status">
            <Icon name="crown" size={18} /> New personal best
          </p>
        )}
        {!isRecord && flags.newBestCategory && (
          <p class="record-badge is-soft" role="status">
            <Icon name="trophy" size={18} /> Best in this category
          </p>
        )}
        {endNote && <p class="results-note">{endNote}</p>}
      </header>

      <div class="results-body">
        <dl class="stat-row">
          <div>
            <dt>Best streak</dt>
            <dd class="tabular">{record.bestStreak}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd class="tabular">{acc === null ? '—' : `${Math.round(acc * 100)}%`}</dd>
          </div>
          <div>
            <dt>{isDaily ? 'Date' : 'Difficulty'}</dt>
            <dd>{isDaily ? prettyDate(record.dateKey ?? todayKey()) : DIFFICULTY_LABEL[record.difficulty]}</dd>
          </div>
        </dl>

        {isDaily && (
          <div class="daily-summary">
            <ol class="dots dots-large" aria-label={`${record.score} of 10 correct`}>
              {r.history.map((q) => (
                <li class={`dot ${q.correct ? 'is-right' : 'is-wrong'}`} aria-hidden="true">
                  <Icon name={q.correct ? 'check' : 'x'} size={14} />
                </li>
              ))}
            </ol>
            <p>
              {r.daily?.official
                ? `Saved as today’s result. Daily streak: ${r.daily.streak} ${r.daily.streak === 1 ? 'day' : 'days'}.`
                : 'Practice run — your official result for today is unchanged.'}
            </p>
          </div>
        )}

        {r.newAchievements.length > 0 && (
          <div class="unlocked" role="status">
            {r.newAchievements.map((id) => {
              const a = ACHIEVEMENTS.find((x) => x.id === id)!;
              return (
                <div class="unlocked-item">
                  <span class="badge-icon">
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span>
                    <strong>Achievement: {a.title}</strong>
                    <span>{a.description}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div class="results-actions">
          <Button variant="primary" size="l" block icon="arrow-counter-clockwise" onClick={again} data-testid="play-again">
            {isDaily ? 'Practise again' : 'Play again'}
          </Button>
          <div class="results-row">
            <Button variant="secondary" icon="share-network" onClick={share}>
              Share
            </Button>
            <Button
              variant="secondary"
              icon="squares-four"
              onClick={() => {
                focusCategories.value = true;
                navigate('play');
              }}
            >
              Categories
            </Button>
          </div>
          <Button variant="ghost" block onClick={() => navigate('play')} data-testid="back-to-play">
            Back to Play
          </Button>
        </div>
      </div>
    </div>
  );
}
