import { CategorySheet } from '../screens/CategorySheet';
import { FactSheet } from '../screens/FactSheet';
import { GameScreen } from '../screens/GameScreen';
import { InstallSheet } from '../screens/InstallSheet';
import { PlayScreen } from '../screens/PlayScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SourcesScreen } from '../screens/SourcesScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { Icon } from '../components/Icon';
import { announcement } from './announce';
import { navigate, route, type Route } from './router';
import { useEffect } from 'preact/hooks';
import { installSheetOpen, openCategory, openFactId, toast, updateReady } from './store';
import { session } from './game';

const TABS: Array<{ route: Route; label: string; icon: string }> = [
  { route: 'play', label: 'Play', icon: 'play' },
  { route: 'stats', label: 'Stats', icon: 'chart-bar' },
  { route: 'settings', label: 'Settings', icon: 'gear' },
];

function TabBar() {
  const r = route.value === 'sources' ? 'settings' : route.value;
  return (
    <nav class="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <a
          href={`#/${t.route}`}
          class={`tab${r === t.route ? ' is-active' : ''}`}
          aria-current={r === t.route ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            navigate(t.route);
          }}
        >
          <Icon name={t.icon} size={24} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

function UpdateBanner() {
  const apply = updateReady.value;
  // Never interrupt an active game: the banner waits until it ends.
  if (!apply || session.value || route.value === 'game') return null;
  return (
    <div class="update-banner" role="status">
      <span>A new version of UPDOWNLY is ready.</span>
      <button type="button" class="update-btn" onClick={() => apply()}>
        Reload
      </button>
    </div>
  );
}

export function App() {
  const r = route.value;
  // Any navigation (including the browser's back button) closes open sheets.
  useEffect(() => {
    openCategory.value = null;
    openFactId.value = null;
    installSheetOpen.value = false;
  }, [r]);
  const fullscreen = r === 'game' || r === 'results';
  return (
    <div class={`app${fullscreen ? ' is-fullscreen' : ''}`}>
      {!fullscreen && (
        <>
          <main class="screen" id="main">
            {r === 'play' && <PlayScreen />}
            {r === 'stats' && <StatsScreen />}
            {r === 'settings' && <SettingsScreen />}
            {r === 'sources' && <SourcesScreen />}
          </main>
          <TabBar />
        </>
      )}
      {r === 'game' && <GameScreen />}
      {r === 'results' && <ResultsScreen />}
      <CategorySheet />
      <FactSheet />
      <InstallSheet />
      <UpdateBanner />
      {toast.value && (
        <div class="toast" role="status" key={toast.value.id}>
          {toast.value.text}
        </div>
      )}
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {announcement.value}
      </div>
    </div>
  );
}
