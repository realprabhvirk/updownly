import { APP, answer, expect, next, open, startCategory, test } from './fixtures';

async function playShortClassic(page: import('@playwright/test').Page, correct = 2) {
  await startCategory(page, /Mountains: Elevation/);
  for (let i = 0; i < correct; i++) {
    await answer(page, true);
    await next(page);
  }
  await answer(page, false);
  await next(page);
  await expect(page.getByTestId('results')).toBeVisible();
}

test('stats reflect finished games and records', async ({ page, errors }) => {
  void errors;
  await open(page);
  await playShortClassic(page, 4);
  await expect(page.locator('.record-badge')).toContainText('New personal best');
  await page.getByTestId('back-to-play').click();
  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.locator('.hero-value')).toHaveText('4');
  await expect(page.locator('.stat-grid')).toContainText('Games played');
  await expect(page.locator('.stat-grid')).toContainText('80%');
  await expect(page.locator('.recent-row')).toHaveCount(1);
  await expect(page.locator('.achievement.is-unlocked')).toHaveCount(1); // First Guess
});

test('settings persist across reloads and themes switch', async ({ page, errors }) => {
  void errors;
  await open(page, '#/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('switch', { name: 'Sound effects' }).click();
  await page.getByRole('radio', { name: 'Hard' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('switch', { name: 'Sound effects' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('radio', { name: 'Hard' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('reset clears all local data after confirmation', async ({ page, errors }) => {
  void errors;
  await open(page);
  await playShortClassic(page, 1);
  await page.goto(`${APP}#/settings`);
  await page.getByRole('button', { name: 'Reset all stats and settings' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.goto(`${APP}#/stats`);
  await expect(page.locator('.hero-value')).toHaveText('1');
  await page.goto(`${APP}#/settings`);
  await page.getByRole('button', { name: 'Reset all stats and settings' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
  await page.goto(`${APP}#/stats`);
  await expect(page.getByText('No games yet')).toBeVisible();
});

test('corrupt saved data does not break the app', async ({ page, errors }) => {
  void errors;
  await page.addInitScript(() => localStorage.setItem('updownly:v1', '{"stats": {"bestClassic": "lots"'));
  await open(page);
  await expect(page.getByRole('button', { name: /Quick Play/ })).toBeVisible();
});

test('data sources screen lists licensed sources', async ({ page, errors }) => {
  void errors;
  await open(page, '#/settings/sources');
  await expect(page.getByRole('heading', { name: 'Data sources' })).toBeVisible();
  await expect(page.locator('.source')).toHaveCount(7);
  await expect(page.locator('.sources')).toContainText('CC BY 4.0');
  await expect(page.locator('.sources')).toContainText('CC0 1.0');
});

test('fact detail sheet shows value, period and source', async ({ page, errors }) => {
  void errors;
  await open(page);
  await startCategory(page, /Countries: Population/);
  await page.locator('.fact-reference .fact-info').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('World Bank');
  await expect(sheet).toContainText('Period');
  await expect(sheet.getByRole('link', { name: /View source record/ })).toHaveAttribute('href', /data\.worldbank\.org/);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});

test('category search filters the browser', async ({ page, errors }) => {
  void errors;
  await open(page);
  await page.getByRole('searchbox', { name: 'Search categories' }).fill('exoplanet');
  await expect(page.locator('.tile')).toHaveCount(4); // three planet pools + star systems
  await page.getByRole('searchbox', { name: 'Search categories' }).fill('volcano');
  await expect(page.getByRole('button', { name: /Mountains: Elevation/ })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search categories' }).fill('zzzz');
  await expect(page.getByText(/No categories match/)).toBeVisible();
});

test('serves every asset from the GitHub Pages subpath', async ({ page, errors }) => {
  void errors;
  const outside: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname === 'localhost' && !u.pathname.startsWith('/updownly/')) outside.push(u.pathname);
  });
  await open(page);
  await startCategory(page, /Mountains: Elevation/);
  await answer(page, true);
  expect(outside).toEqual([]);
  const manifest = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(manifest).not.toMatch(/^\//);
});

test('works offline after the first load, including unvisited categories', async ({ page, context, errors }) => {
  void errors;
  await open(page);
  // The service worker precaches everything on install, then claims the page.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /Quick Play/ })).toBeVisible();
  // A category never loaded online: its data must come from the precache.
  await startCategory(page, /Islands: Area/);
  await answer(page, true);
  await expect(page.getByTestId('score')).toHaveText('1');
  await context.setOffline(false);
});

test('narrow screens: long names and huge values do not overflow', async ({ page, errors }) => {
  void errors;
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, '#/play', `${APP}&fixtures=1`);
  await page.getByRole('searchbox', { name: 'Search categories' }).fill('Long names');
  await startCategory(page, /Test fixture: Long names/);
  for (let i = 0; i < 4; i++) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await page.locator('.fact-reference .fact-number').boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    await answer(page, true);
    await next(page);
  }
});

test('dark theme renders the game', async ({ page, errors }) => {
  void errors;
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await startCategory(page, /Mountains: Elevation/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(11, 17, 28)');
});

test('iOS install help appears after a game and never claims an install', async ({ page, errors }) => {
  void errors;
  await open(page);
  await playShortClassic(page, 1);
  await page.getByTestId('back-to-play').click();
  await page.getByRole('button', { name: 'Show me how' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add to Home Screen' });
  await expect(sheet).toContainText('Share');
  await expect(sheet).toContainText('Add to Home Screen');
  await expect(sheet).not.toContainText(/installed/i);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByRole('button', { name: 'Show me how' })).toHaveCount(0);
});

test('answers are announced to screen readers after, not before, answering', async ({ page, errors }) => {
  void errors;
  await open(page);
  await startCategory(page, /Mountains: Elevation/);
  const live = page.locator('[aria-live="polite"]');
  await expect(live).toHaveText('');
  await answer(page, true);
  await expect(live).toContainText('Correct');
  await expect(live).toContainText(' m');
});
