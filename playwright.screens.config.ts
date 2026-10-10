import { defineConfig } from '@playwright/test';

/** `npm run screens` — captures review screenshots into design/screens/. */
const PORT = 4175;
export default defineConfig({
  testDir: 'tests/screens',
  timeout: 180_000,
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}/updownly/`, browserName: 'chromium', serviceWorkers: 'block' },
  webServer: {
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --base /updownly/ --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/updownly/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
