import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { navigate } from '../app/router';
import { clearHistory, installSheetOpen, resetAll, save, showToast, storageAvailable, updateSettings } from '../app/store';
import { ConfirmDialog } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { Segmented } from '../components/Segmented';
import { Toggle } from '../components/Toggle';
import { TOTAL_FACTS } from '../data/catalog';
import { BRAND } from '../design/strings';
import { hapticsSupported } from '../services/haptics';
import { isStandalone } from '../services/platform';

function Group({ title, children, footer }: { title: string; children: ComponentChildren; footer?: ComponentChildren }) {
  return (
    <section class="inset">
      <h2 class="inset-title">{title}</h2>
      <div class="inset-list">{children}</div>
      {footer && <p class="inset-footer">{footer}</p>}
    </section>
  );
}

function Row({ label, children, sub }: { label: string; children?: ComponentChildren; sub?: string }) {
  return (
    <div class="row">
      <span class="row-text">
        <span class="row-label">{label}</span>
        {sub && <span class="row-sub">{sub}</span>}
      </span>
      <span class="row-control">{children}</span>
    </div>
  );
}

function LinkRow({ label, icon, onClick, value, destructive }: { label: string; icon: string; onClick: () => void; value?: string; destructive?: boolean }) {
  return (
    <button type="button" class={`row row-link${destructive ? ' is-destructive' : ''}`} onClick={onClick}>
      <span class="row-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span class="row-label">{label}</span>
      {value && <span class="row-value">{value}</span>}
      {!destructive && <Icon name="caret-right" size={16} class="row-chevron" />}
    </button>
  );
}

export function SettingsScreen() {
  const s = save.value.settings;
  const [confirm, setConfirm] = useState<null | 'history' | 'reset'>(null);
  const haptics = hapticsSupported();

  return (
    <div class="page settings">
      <h1 class="page-title">Settings</h1>

      <Group title="Gameplay">
        <Row label="Default mode">
          <Segmented
            label="Default mode"
            value={s.defaultMode}
            options={[
              { value: 'classic', label: 'Classic' },
              { value: 'sprint', label: 'Sprint' },
            ]}
            onChange={(v) => updateSettings({ defaultMode: v })}
          />
        </Row>
        <Row label="Default difficulty">
          <Segmented
            label="Default difficulty"
            value={s.defaultDifficulty}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'normal', label: 'Normal' },
              { value: 'hard', label: 'Hard' },
            ]}
            onChange={(v) => updateSettings({ defaultDifficulty: v })}
          />
        </Row>
        <Row label="Sound effects">
          <Toggle label="Sound effects" checked={s.sound} onChange={(v) => updateSettings({ sound: v })} />
        </Row>
        <Row label="Haptics" sub={haptics ? undefined : 'Not supported in this browser'}>
          <Toggle label="Haptics" checked={s.haptics && haptics} disabled={!haptics} onChange={(v) => updateSettings({ haptics: v })} />
        </Row>
        <Row label="Reduce motion" sub={s.motion === 'system' ? 'Following your device setting' : undefined}>
          <Segmented
            label="Reduce motion"
            value={s.motion}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'reduce', label: 'On' },
              { value: 'full', label: 'Off' },
            ]}
            onChange={(v) => updateSettings({ motion: v })}
          />
        </Row>
      </Group>

      <Group title="Appearance">
        <Row label="Theme">
          <Segmented
            label="Theme"
            value={s.theme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(v) => updateSettings({ theme: v })}
          />
        </Row>
      </Group>

      <Group
        title="Data & privacy"
        footer={
          storageAvailable
            ? 'Your stats and settings are stored only on this device. Nothing is sent anywhere.'
            : 'Storage is unavailable in this browser mode, so stats last only until you close the app.'
        }
      >
        <LinkRow label="Data sources" icon="book-open" value={`${TOTAL_FACTS.toLocaleString('en-GB')} facts`} onClick={() => navigate('sources')} />
        <LinkRow label="Clear recent games" icon="arrow-counter-clockwise" onClick={() => setConfirm('history')} destructive />
        <LinkRow label="Reset all stats and settings" icon="trash" onClick={() => setConfirm('reset')} destructive />
      </Group>

      <Group title="About">
        <LinkRow
          label="Add to Home Screen"
          icon="device-mobile"
          value={isStandalone() ? 'Installed' : undefined}
          onClick={() => (installSheetOpen.value = true)}
        />
        <Row label="Version" sub={`Build ${__BUILD_STAMP__} · Data ${__DATA_VERSION__}`}>
          <span class="row-value">{__APP_VERSION__}</span>
        </Row>
        <div class="about">
          <p>
            <strong>{BRAND.name}</strong> is an offline-first trivia game. After the first load every category plays
            without a connection, and everything you do stays on this device: no accounts, no tracking, no ads.
          </p>
          <p>
            Facts come from openly licensed public datasets — see Data sources for attribution. Icons: Phosphor (MIT).
            Display type: Bricolage Grotesque (SIL OFL).
          </p>
        </div>
      </Group>

      <ConfirmDialog
        open={confirm === 'history'}
        title="Clear recent games?"
        message="Your recent games list will be emptied. Records, achievements and settings are kept."
        confirmLabel="Clear"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          clearHistory();
          setConfirm(null);
          showToast('Recent games cleared');
        }}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset everything?"
        message="All stats, records, Daily Challenge results, achievements and settings will be permanently deleted from this device."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          resetAll();
          setConfirm(null);
          showToast('All data reset');
        }}
      />
    </div>
  );
}
