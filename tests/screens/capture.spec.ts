import { test, expect, type Page } from '@playwright/test';

const APP = './?seed=7&date=2026-10-10';
const OUT = 'design/screens';

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844, scale: 2, full: true },
  { name: '375x812', width: 375, height: 812, scale: 2, full: false },
  { name: '844x390', width: 844, height: 390, scale: 1, full: false },
  { name: '1440x900', width: 1440, height: 900, scale: 1, full: false },
] as const;

async function expectedDir(page: Page) {
  await expect(page.getByTestId('answer-higher')).toBeVisible();
  return page.evaluate(() => (window as unknown as { __updownly: { expected: () => 'higher' | 'lower' } }).__updownly.expected());
}
async function answer(page: Page, correct: boolean) {
  const right = await expectedDir(page);
  await page.getByTestId(`answer-${correct ? right : right === 'higher' ? 'lower' : 'higher'}`).click();
  await expect(page.getByTestId('verdict')).toBeVisible();
  await page.waitForTimeout(700); // let the reveal settle
}
async function startCategory(page: Page, name: RegExp) {
  await page.getByRole('button', { name }).first().click();
  await page.getByRole('dialog').getByTestId('start-game').click();
  await expect(page.getByTestId('game')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${vp.name} ${theme}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.scale,
        colorScheme: theme,
        isMobile: vp.width < 900,
        hasTouch: vp.width < 900,
        userAgent:
          vp.width < 900
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
            : undefined,
      });
      const page = await ctx.newPage();
      let n = 0;
      const shot = async (name: string, full = false) => {
        n++;
        await page.waitForTimeout(650);
        await page.screenshot({ path: `${OUT}/${vp.name}-${theme}-${String(n).padStart(2, '0')}-${name}.png`, fullPage: full });
      };
      const all = vp.full;

      // Empty states first (fresh storage).
      await page.goto(`${APP}#/stats`);
      if (all) await shot('stats-empty');
      await page.goto(`${APP}#/play`);
      await shot('play');
      if (all) {
        await page.locator('#categories').scrollIntoViewIfNeeded();
        await page.evaluate(() => document.getElementById('categories')!.scrollIntoView());
        await shot('category-browser');
        await page.getByRole('searchbox', { name: 'Search categories' }).fill('pyramids');
        await shot('search-empty');
        await page.getByRole('searchbox', { name: 'Search categories' }).fill('');
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole('button', { name: /Mountains: Elevation/ }).click();
        await shot('category-sheet');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: /Quick Play/ }).click();
        await shot('ready-first-game');
        await page.getByRole('button', { name: 'Back' }).click();
      }

      // A Classic game: question, correct reveal, then a miss and results.
      await startCategory(page, /Mountains: Elevation/);
      await shot('question');
      await answer(page, true);
      await shot('correct');
      if (all) {
        await page.locator('.fact-reference .fact-info').click();
        await shot('fact-detail');
        await page.keyboard.press('Escape');
      }
      for (let i = 0; i < 5; i++) {
        await page.getByTestId('continue').click();
        await answer(page, true);
      }
      await page.getByTestId('continue').click();
      await answer(page, false);
      await shot('incorrect');
      await page.getByTestId('continue').click();
      await expect(page.getByTestId('results')).toBeVisible();
      await page.waitForTimeout(500);
      await shot('results-record');

      if (all) {
        // Daily Challenge.
        await page.goto(`${APP}#/play`);
        await page.getByRole('button', { name: /Daily/ }).click();
        await page.getByTestId('ready-start').click();
        for (let i = 0; i < 10; i++) {
          if (i === 3) await shot('daily-question');
          await answer(page, i !== 2 && i !== 6);
          await page.getByTestId('continue').click();
        }
        await expect(page.getByTestId('results')).toBeVisible();
        await shot('daily-results');

        // Sprint (first seconds).
        await page.goto(`${APP}#/play`);
        await page.getByRole('button', { name: /Sprint/ }).click();
        await page.getByTestId('ready-start').click();
        await expect(page.getByTestId('answer-higher')).toBeVisible();
        await shot('sprint');
        await page.getByTestId('exit-game').click();
        await page.getByRole('dialog').getByRole('button', { name: 'End game' }).click();

        await page.goto(`${APP}#/stats`);
        await shot('stats');
        await shot('stats-full', true);
        await page.goto(`${APP}#/play`);
        await page.getByRole('button', { name: 'Show me how' }).click();
        await shot('install-help');
        await page.goto(`${APP}#/settings/sources`);
        await shot('data-sources');
        await page.goto(`${APP}#/facts`);
        await expect(page.getByTestId('fact-of-the-day')).toContainText(/No\. \d+/);
        await shot('facts');
        await page.getByRole('button', { name: /^Countries: Population\./ }).click();
        await expect(page.locator('.rank-row').first()).toBeVisible();
        await shot('facts-ranking');
      }
      await page.goto(`${APP}#/settings`);
      await shot('settings');
      await ctx.close();
    });
  }
}
