import { useEffect, useState } from 'preact/hooks';
import { loadingCollection, startGame } from '../app/game';
import { navigate } from '../app/router';
import { openCategory, save } from '../app/store';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Segmented } from '../components/Segmented';
import { collectionInfo } from '../data/catalog';
import { DIFFICULTY_HINT } from '../design/strings';
import type { Difficulty } from '../game/types';
import type { PlayMode } from '../services/storage';

export function CategorySheet() {
  const id = openCategory.value;
  const info = id ? collectionInfo(id) : undefined;
  const s = save.value.settings;
  const [mode, setMode] = useState<PlayMode>(s.defaultMode);
  const [difficulty, setDifficulty] = useState<Difficulty>(s.defaultDifficulty);

  useEffect(() => {
    if (!id) return;
    setMode(save.value.settings.defaultMode);
    setDifficulty(save.value.settings.categoryDifficulty[id] ?? save.value.settings.defaultDifficulty);
  }, [id]);

  const close = () => (openCategory.value = null);
  if (!info) return <BottomSheet open={false} onClose={close} label="">{null}</BottomSheet>;
  const best = save.value.stats.bestByCategory[info.id];
  const busy = loadingCollection.value === info.id;

  const start = async () => {
    await startGame({ collectionId: info.id, mode, difficulty, autoStart: true });
    close();
  };

  return (
    <BottomSheet open onClose={close} label={`${info.title}: ${info.subtitle}`}>
      <div class="cat" style={{ '--cat': info.group.colour }}>
        <header class="cat-head">
          <span class="cat-icon" aria-hidden="true">
            <Icon name={info.icon} size={30} />
          </span>
          <div>
            <p class="cat-group">{info.group.title}</p>
            <h2 class="cat-title">
              {info.title} <span>{info.subtitle}</span>
            </h2>
          </div>
        </header>
        <p class="cat-desc">{info.description}</p>
        <dl class="cat-facts">
          <div>
            <dt>Facts</dt>
            <dd>{info.count.toLocaleString('en-GB')}</dd>
          </div>
          <div>
            <dt>Period</dt>
            <dd>{info.periodLabel}</dd>
          </div>
          <div>
            <dt>Your best</dt>
            <dd>{best?.classic ? best.classic : '—'}</dd>
          </div>
        </dl>
        <p class="cat-metric">
          <strong>{info.metric.label}:</strong> {info.metric.comparisonDescription}
        </p>

        <div class="cat-field">
          <span class="field-label" id="mode-label">
            Mode
          </span>
          <Segmented
            label="Mode"
            value={mode}
            options={[
              { value: 'classic', label: 'Classic' },
              { value: 'sprint', label: '60s Sprint' },
            ]}
            onChange={setMode}
          />
        </div>
        <div class="cat-field">
          <span class="field-label">Difficulty</span>
          <Segmented
            label="Difficulty"
            value={difficulty}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'normal', label: 'Normal' },
              { value: 'hard', label: 'Hard' },
            ]}
            onChange={setDifficulty}
          />
          <p class="field-hint">{DIFFICULTY_HINT[difficulty]}</p>
        </div>

        <Button variant="primary" size="l" block icon="play" onClick={start} disabled={busy} data-autofocus data-testid="start-game">
          {busy ? 'Loading…' : mode === 'sprint' ? 'Start Sprint' : 'Start'}
        </Button>
        <p class="cat-source">
          Source: {info.source.name} · {info.source.licence}.{' '}
          <button
            type="button"
            class="link"
            onClick={() => {
              close();
              navigate('sources');
            }}
          >
            About the data
          </button>
        </p>
      </div>
    </BottomSheet>
  );
}
