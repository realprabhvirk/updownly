import { effect } from '@preact/signals';
import { render } from 'preact';
import { App } from './app/App';
import { startRouter } from './app/router';
import { effectiveTheme, reducedMotion, systemDark, systemReducedMotion, updateReady } from './app/store';
import { THEME_COLOR } from './design/tokens';
import './design/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/screens.css';

// Resolve system preferences once and keep them live.
const watch = (query: string, set: (v: boolean) => void) => {
  try {
    const mq = window.matchMedia(query);
    set(mq.matches);
    mq.addEventListener('change', (e) => set(e.matches));
  } catch {
    // matchMedia unavailable: keep defaults.
  }
};
watch('(prefers-color-scheme: dark)', (v) => (systemDark.value = v));
watch('(prefers-reduced-motion: reduce)', (v) => (systemReducedMotion.value = v));

effect(() => {
  const root = document.documentElement;
  root.dataset.theme = effectiveTheme.value;
  root.dataset.motion = reducedMotion.value ? 'reduce' : 'full';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[effectiveTheme.value]);
});

async function boot(): Promise<void> {
  // End-to-end builds register deterministic fixture categories. The
  // branch is compiled out of production builds.
  if (__E2E__) (await import('./data/fixtures')).registerFixtures();
  startRouter();
  render(<App />, document.getElementById('app')!);
}
void boot();

// Service worker: offline support plus a user-controlled update prompt.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateReady.value = () => void update(true);
      },
    });
  });
}
