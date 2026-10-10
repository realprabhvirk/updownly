import { test as base, expect, type Page } from '@playwright/test';

/** Every test fails if the page logs a console error or throws. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  },
});
export { expect };

export const APP = './?seed=7&date=2026-10-10';

export async function open(page: Page, hash = '#/play', query = APP): Promise<void> {
  await page.goto(`${query}${hash}`);
  await expect(page.locator('#app')).not.toBeEmpty();
}

/** Expected answer for the current question (test builds only). */
export async function expected(page: Page): Promise<'higher' | 'lower'> {
  await expect(page.getByTestId('answer-higher')).toBeVisible();
  const dir = await page.evaluate(() => (window as unknown as { __updownly: { expected: () => string } }).__updownly.expected());
  return dir as 'higher' | 'lower';
}

export async function answer(page: Page, correct: boolean): Promise<void> {
  const right = await expected(page);
  const pick = correct ? right : right === 'higher' ? 'lower' : 'higher';
  await page.getByTestId(`answer-${pick}`).click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', String(correct));
}

export async function next(page: Page): Promise<void> {
  await page.getByTestId('continue').click();
}

export async function startCategory(page: Page, title: RegExp, difficulty?: 'Easy' | 'Normal' | 'Hard', mode?: 'Classic' | '60s Sprint') {
  await page.getByRole('button', { name: title }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  if (mode) await sheet.getByRole('radio', { name: mode }).click();
  if (difficulty) await sheet.getByRole('radio', { name: difficulty }).click();
  await sheet.getByTestId('start-game').click();
  await expect(page.getByTestId('game')).toBeVisible();
}
