import { APP, answer, expect, expected, next, open, startCategory, test } from './fixtures';

test.describe('Classic gameplay', () => {
  test('Quick Play opens a ready screen and starts a round', async ({ page, errors }) => {
    void errors;
    await open(page);
    await page.getByRole('button', { name: /Quick Play/ }).click();
    await expect(page.getByTestId('ready-start')).toBeVisible();
    await page.getByTestId('ready-start').click();
    await expect(page.getByTestId('answer-higher')).toBeVisible();
    await expect(page.getByTestId('answer-lower')).toBeVisible();
    await expect(page.getByTestId('score')).toHaveText('0');
  });

  test('choose a category and difficulty, then answer correctly and incorrectly', async ({ page, errors }) => {
    void errors;
    await open(page);
    await startCategory(page, /Mountains: Elevation/, 'Hard');
    await expect(page.locator('.game-cat')).toContainText('Mountains');

    await answer(page, true);
    await expect(page.getByTestId('score')).toHaveText('1');
    await next(page);
    await answer(page, true);
    await expect(page.getByTestId('score')).toHaveText('2');
    await next(page);
    await answer(page, true);
    await expect(page.getByTestId('score')).toHaveText('3');
    await next(page);
    await answer(page, false);
    await expect(page.getByTestId('continue')).toHaveText(/See results/);
    await next(page);

    await expect(page.getByTestId('results')).toBeVisible();
    await expect(page.getByTestId('final-score')).toHaveText('3');
    await expect(page.locator('.stat-row')).toContainText('Best streak');
    await expect(page.locator('.stat-row')).toContainText('75%');
    await expect(page.locator('.results-eyebrow')).toContainText('Classic');
  });

  test('the revealed challenger becomes the next reference', async ({ page, errors }) => {
    void errors;
    await open(page);
    await startCategory(page, /Rivers: Length/);
    const challenger = await page.locator('.fact-challenger .fact-name').textContent();
    await answer(page, true);
    await next(page);
    await expect(page.locator('.fact-reference .fact-name')).toHaveText(challenger!);
  });

  test('hidden values are not in the DOM before answering', async ({ page, errors }) => {
    void errors;
    await open(page);
    await startCategory(page, /Countries: Population/);
    const state = await page.evaluate(() =>
      (window as unknown as { __updownly: { state: () => { current: { challenger: { value: number } } } } }).__updownly.state(),
    );
    const value = state.current.challenger.value;
    const html = await page.locator('[data-testid=game]').innerHTML();
    const formatted = value.toLocaleString('en-GB');
    expect(html).not.toContain(formatted);
    await expect(page.locator('.fact-challenger .fact-hidden')).toBeVisible();
  });

  test('rapid repeated taps score only once', async ({ page, errors }) => {
    void errors;
    await open(page);
    await startCategory(page, /Mountains: Elevation/);
    const right = await expected(page);
    const btn = page.getByTestId(`answer-${right}`);
    await btn.evaluate((el) => {
      for (let i = 0; i < 8; i++) (el as HTMLButtonElement).click();
    });
    await expect(page.getByTestId('score')).toHaveText('1');
    const answered = await page.evaluate(
      () => (window as unknown as { __updownly: { state: () => { answered: number } } }).__updownly.state().answered,
    );
    expect(answered).toBe(1);
  });

  test('keyboard controls play the game', async ({ page, errors }) => {
    void errors;
    await open(page);
    await startCategory(page, /Mountains: Elevation/);
    const right = await expected(page);
    await page.keyboard.press(right === 'higher' ? 'ArrowUp' : 'ArrowDown');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-correct', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('answer-higher')).toBeVisible();
    await expect(page.getByTestId('score')).toHaveText('1');
  });

  test('leaving a round early creates no record', async ({ page, errors }) => {
    void errors;
    await open(page);
    await startCategory(page, /Mountains: Elevation/);
    await answer(page, true);
    await next(page);
    await page.getByTestId('exit-game').click();
    await page.getByRole('dialog').getByRole('button', { name: 'End game' }).click();
    await expect(page.getByRole('button', { name: /Quick Play/ })).toBeVisible();
    await page.goto(`${APP}#/stats`);
    await expect(page.getByText('No games yet')).toBeVisible();
  });

  test('navigating away and back resumes the running game', async ({ page, errors }) => {
    void errors;
    await open(page);
    await startCategory(page, /Mountains: Elevation/);
    await answer(page, true);
    await next(page);
    await answer(page, true);
    await next(page);
    const ref = await page.locator('.fact-reference .fact-name').textContent();
    await page.goBack(); // browser back to Play
    await expect(page.getByText('Game in progress')).toBeVisible();
    await page.getByRole('button', { name: /Game in progress/ }).click();
    await expect(page.getByTestId('score')).toHaveText('2');
    await expect(page.locator('.fact-reference .fact-name')).toHaveText(ref!);
  });
});

test.describe('Sprint', () => {
  test('continues after misses and ends when the clock runs out', async ({ page, errors }) => {
    void errors;
    await page.clock.install();
    await open(page);
    await startCategory(page, /Rivers: Length/, 'Normal', '60s Sprint');
    await answer(page, false);
    // Sprint auto-advances after a reveal; a miss does not end the run.
    await page.clock.runFor(1500);
    await expect(page.getByTestId('answer-higher')).toBeVisible();
    await answer(page, true);
    await page.clock.runFor(1500);
    await answer(page, true);
    await page.clock.runFor(61_000);
    await expect(page.getByTestId('results')).toBeVisible();
    await expect(page.getByTestId('final-score')).toHaveText('2');
    await expect(page.locator('.results-note')).toHaveText(/Time’s up/);
  });
});

test.describe('Daily Challenge', () => {
  test('ten questions, saved once, replays are practice', async ({ page, errors }) => {
    void errors;
    await open(page);
    await page.getByRole('button', { name: /Daily/ }).click();
    await page.getByTestId('ready-start').click();
    const first = await page.locator('.fact-reference .fact-name').textContent();
    for (let i = 0; i < 10; i++) {
      await answer(page, i !== 3); // one miss
      await next(page);
    }
    await expect(page.getByTestId('results')).toBeVisible();
    await expect(page.getByTestId('final-score')).toHaveText('9');
    await expect(page.locator('.daily-summary')).toContainText('Saved as today’s result');

    // Persistence: survives a reload.
    await page.goto(`${APP}#/play`);
    await expect(page.locator('.mode-daily')).toContainText('9/10');

    // Same date → same sequence; replay is practice and cannot overwrite.
    await page.locator('.mode-daily').click();
    await expect(page.getByText(/practice run/i)).toBeVisible();
    await page.getByTestId('ready-start').click();
    await expect(page.locator('.fact-reference .fact-name')).toHaveText(first!);
    for (let i = 0; i < 10; i++) {
      await answer(page, true);
      await next(page);
    }
    await expect(page.getByTestId('final-score')).toHaveText('10');
    await expect(page.locator('.daily-summary')).toContainText('Practice run');
    await page.goto(`${APP}#/play`);
    await expect(page.locator('.mode-daily')).toContainText('9/10');
  });

  test('a different date gives a different challenge', async ({ page, errors }) => {
    void errors;
    await open(page, '#/play', './?seed=7&date=2026-10-10');
    const a = await page.locator('.mode-daily .mode-sub').textContent();
    await open(page, '#/play', './?seed=7&date=2026-10-11');
    const b = await page.locator('.mode-daily .mode-sub').textContent();
    expect(a).not.toEqual(b);
  });
});

test('a Sprint that ends while away is saved and its result is offered', async ({ page, errors }) => {
  void errors;
  await page.clock.install();
  await open(page);
  await startCategory(page, /Rivers: Length/, 'Normal', '60s Sprint');
  await answer(page, true);
  await page.goBack();
  await expect(page.getByText('Game in progress')).toBeVisible();
  await page.clock.runFor(61_000);
  await expect(page.getByText('Time’s up on your Sprint')).toBeVisible();
  await page.getByRole('button', { name: /Time’s up on your Sprint/ }).click();
  await expect(page.getByTestId('final-score')).toHaveText('1');
});
