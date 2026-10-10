import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a production-style build (with test hooks,
 * --mode e2e) served under a GitHub Pages-like subpath: /updownly/.
 */
const PORT = 4174;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/updownly/`,
    ...devices['iPhone 13'],
    // iPhone 13 profile on Chromium (WebKit is not required to run locally).
    browserName: 'chromium',
    defaultBrowserType: 'chromium',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build:e2e && npx vite preview --mode e2e --base /updownly/ --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/updownly/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
