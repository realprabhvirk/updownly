import { todayKey } from '../app/game';
import { save } from '../app/store';
import { Icon } from '../components/Icon';
import { collectionInfo } from '../data/catalog';
import { ACHIEVEMENTS } from '../game/achievements';
import { addDays, dailyStreak } from '../game/daily';
import { accuracy, bestCategory } from '../game/scoring';
import { MODE_SHORT } from '../design/strings';

const n = (x: number) => x.toLocaleString('en-GB');

function relativeDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function StatsScreen() {
  const s = save.value;
  const st = s.stats;
  const acc = accuracy(st.correctAnswers, st.questionsAnswered);
  const best = bestCategory(st);
  const bestInfo = best ? collectionInfo(best.collectionId) : undefined;
  const today = todayKey();
  const dailyDates = Object.keys(s.daily);
  const streak = dailyStreak(dailyDates, today);
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const unlockedCount = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;

  if (st.gamesPlayed === 0) {
    return (
      <div class="page">
        <h1 class="page-title">Stats</h1>
        <div class="empty empty-page">
          <Icon name="chart-bar" size={36} />
          <h2>No games yet</h2>
          <p>Finish a game and your records, streaks and achievements will appear here.</p>
        </div>
        <Achievements />
      </div>
    );
  }

  return (
    <div class="page stats">
      <h1 class="page-title">Stats</h1>

      <section class="hero-stat">
        <p class="hero-label">Best Classic score</p>
        <p class="hero-value tabular">{st.bestClassic}</p>
        <p class="hero-sub">
          {bestInfo ? (
            <>
              Best category: <strong>{bestInfo.title} · {bestInfo.subtitle}</strong> ({best!.score})
            </>
          ) : (
            'Play Classic to set your best.'
          )}
        </p>
      </section>

      <dl class="stat-grid">
        <div>
          <dt>Games played</dt>
          <dd class="tabular">{n(st.gamesPlayed)}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd class="tabular">{st.bestStreak}</dd>
        </div>
        <div>
          <dt>Correct answers</dt>
          <dd class="tabular">{n(st.correctAnswers)}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd class="tabular">{acc === null ? '—' : `${Math.round(acc * 100)}%`}</dd>
        </div>
        <div>
          <dt>Best Sprint</dt>
          <dd class="tabular">{st.bestSprint || '—'}</dd>
        </div>
        <div>
          <dt>Categories played</dt>
          <dd class="tabular">{st.collectionsPlayed.length}</dd>
        </div>
      </dl>

      <section class="card daily-card">
        <div class="card-head">
          <h2 class="card-title">
            <Icon name="calendar-check" size={18} /> Daily Challenge
          </h2>
          <span class="card-meta">{dailyDates.length} completed</span>
        </div>
        <div class="daily-streak">
          <span class="daily-streak-n tabular">{streak}</span>
          <span>{streak === 1 ? 'day streak' : 'day streak'}</span>
        </div>
        <ol class="week" aria-label="Last seven days">
          {last7.map((d) => {
            const r = s.daily[d];
            const label = new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' });
            return (
              <li class={`week-day${r ? ' is-done' : ''}${d === today ? ' is-today' : ''}`} aria-label={`${d}: ${r ? `${r.score}/10` : 'not played'}`}>
                <span class="week-box">{r ? r.score : ''}</span>
                <span class="week-label" aria-hidden="true">
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <Achievements />

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Recent games</h2>
          <span class="card-meta">Last {s.recent.length}</span>
        </div>
        <ul class="recent">
          {s.recent.map((g) => {
            const info = collectionInfo(g.collectionId);
            return (
              <li class="recent-row">
                <span class="recent-icon" style={{ '--tile': info?.group.colour ?? 'var(--surface-3)' }} aria-hidden="true">
                  <Icon name={info?.icon ?? 'play'} size={18} />
                </span>
                <span class="recent-main">
                  <strong>{info ? `${info.title} · ${info.subtitle}` : g.collectionId}</strong>
                  <span>
                    {MODE_SHORT[g.mode]}
                    {g.practice ? ' (practice)' : ''} · {relativeDay(g.at)}
                  </span>
                </span>
                <span class="recent-score tabular">
                  {g.score}
                  {g.mode === 'daily' ? <small>/10</small> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <p class="fine">
        {unlockedCount} of {ACHIEVEMENTS.length} achievements unlocked. Everything here is stored only on this device.
      </p>
    </div>
  );
}

function Achievements() {
  const s = save.value;
  return (
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Achievements</h2>
      </div>
      <ul class="achievements">
        {ACHIEVEMENTS.map((a) => {
          const at = s.achievements[a.id];
          return (
            <li class={`achievement${at ? ' is-unlocked' : ''}`}>
              <span class="badge-icon" aria-hidden="true">
                <Icon name={at ? a.icon : 'lock-simple'} size={20} />
              </span>
              <span class="achievement-text">
                <strong>{a.title}</strong>
                <span>{a.description}</span>
              </span>
              <span class="sr-only">{at ? 'Unlocked' : 'Locked'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
