import { expect, open, test } from './fixtures';

test('Facts tab: browse rankings, flip order, open details', async ({ page, errors }) => {
  void errors;
  await open(page);
  await page.getByRole('link', { name: 'Facts' }).click();
  await expect(page.getByRole('heading', { name: 'Facts' })).toBeVisible();
  await expect(page.getByTestId('fact-of-the-day')).toContainText(/No\. \d+ for/);

  // A World Bank category has both ends.
  await page.getByRole('button', { name: /^Countries: Population\./ }).click();
  const rows = page.locator('.rank-row');
  await expect(rows).toHaveCount(25);
  await expect(rows.first()).toContainText(/billion/);
  await page.getByRole('button', { name: /Show all 50/ }).click();
  await expect(rows).toHaveCount(50);
  await page.getByRole('radio', { name: /Bottom 20/ }).click();
  await expect(rows).toHaveCount(20);
  await rows.first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('No. 1 lowest');
  await expect(sheet).toContainText('World Bank');
  await page.keyboard.press('Escape');

  // A threshold-filtered pool shows only a top list.
  await page.getByRole('button', { name: 'Facts' }).click();
  await page.getByRole('button', { name: /Mountains: Elevation/ }).click();
  await expect(page.getByRole('radio', { name: /Bottom/ })).toHaveCount(0);
  await expect(page.getByText(/no bottom list/)).toBeVisible();
  await expect(rows.first()).toContainText('Mount Everest');
});
