/**
 * Hash routing: works under any base path (GitHub Pages subpaths included)
 * and survives reloads without server rewrites.
 */
import { signal } from '@preact/signals';

export type Route = 'play' | 'facts' | 'stats' | 'settings' | 'sources' | 'game' | 'results';

const PATHS: Record<Route, string> = {
  play: '#/play',
  facts: '#/facts',
  stats: '#/stats',
  settings: '#/settings',
  sources: '#/settings/sources',
  game: '#/game',
  results: '#/results',
};

export function parseHash(hash: string): Route {
  const entry = (Object.entries(PATHS) as Array<[Route, string]>).find(([, p]) => p === hash);
  return entry ? entry[0] : 'play';
}

export const route = signal<Route>(typeof location === 'undefined' ? 'play' : parseHash(location.hash));

export function navigate(to: Route, opts: { replace?: boolean } = {}): void {
  const target = PATHS[to];
  if (location.hash === target) {
    route.value = to;
    return;
  }
  if (opts.replace) {
    history.replaceState(history.state, '', target);
    route.value = to;
  } else {
    location.hash = target; // fires hashchange
  }
}

export function startRouter(): void {
  window.addEventListener('hashchange', () => {
    route.value = parseHash(location.hash);
  });
  if (!location.hash) history.replaceState(null, '', PATHS.play);
}
