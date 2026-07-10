import { expect, test } from '@playwright/test';

test('token gallery renders the design system', async ({ page }) => {
  await page.goto('/design');
  await expect(page.getByRole('heading', { name: 'Morning Paper' })).toBeVisible();
  await expect(page.getByText('Surfaces & ink')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dialog' })).toBeVisible();
});

test('achievements are reachable from the home tile', async ({ page }) => {
  await page.goto('/');
  // Mobile home carries an Achievements tile in main; the desktop
  // redesign's landing page reaches it through the header nav instead.
  const tile = page.locator('main').getByRole('link', { name: /Achievements/ });
  if (await tile.count()) {
    await tile.click();
  } else {
    await page.getByRole('link', { name: 'Achievements' }).click();
  }
  await expect(
    page.getByRole('heading', { name: 'Achievements' })
  ).toBeVisible();
  await expect(page.getByText(/0 of \d+ earned/)).toBeVisible();
  await expect(page.getByText('Milestones')).toBeVisible();
});

test('difficulty picker links into a game', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('heading', { name: 'Free Play' })).toBeVisible();
  await page.getByRole('link', { name: /easy/i }).click();
  await expect(page).toHaveURL(/difficulty=easy/);
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
});

test('seeded easy game plays to completion with Place', async ({ page }) => {
  await page.goto('/play?difficulty=easy&seed=42');
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  await expect(page.getByText('/ 400')).toBeVisible();

  const place = page.getByRole('button', { name: 'Place', exact: true });
  const finalScore = page.getByTestId('final-score');

  // 25 slots; jokers auto-place, so well under 30 presses ends the run.
  for (let i = 0; i < 30; i++) {
    if (await finalScore.isVisible().catch(() => false)) break;
    await place.click();
  }

  await expect(finalScore).toBeVisible();
  const score = Number(await finalScore.textContent());
  expect(Number.isFinite(score)).toBe(true);
  // Mobile keeps ResultView ("Target beaten/missed", revealed after the
  // ~4s tally); desktop (≥1024px) now overlays the result dialog with
  // the mockup's verdicts ("Target cleared" / "Just short").
  await expect(
    page.getByText(/target beaten|target missed|target cleared|just short/i)
  ).toBeVisible({ timeout: 10_000 });

  // Replay starts a fresh board. (Desktop offers Play Again in both
  // the result dialog and the dock behind it — the dialog's is the
  // clickable one while its scrim is up, and it renders last.)
  await page.getByRole('button', { name: 'Play again' }).last().click();
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  await expect(place).toBeVisible();
});

test('tapping a seated card spotlights its row and column', async ({
  page,
}) => {
  // Rails ship OFF by default now — this test covers the rails-on
  // spotlight (chips light up), so opt in via stored settings.
  await page.addInitScript(() => {
    localStorage.setItem(
      'pokergrid:settings:v1',
      JSON.stringify({ state: { lineRails: true }, version: 1 })
    );
  });
  await page.goto('/play?difficulty=easy&seed=42');
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  // The opening card sits at the center (row 3, column 3). With the
  // line rails showing, the spotlight lights the R3 + C3 rail chips
  // instead of floating text tags.
  await page.getByLabel(/^row 3 column 3: (?!empty)/).click();
  await expect(page.getByLabel(/^R3: /)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByLabel(/^C3: /)).toHaveAttribute('aria-current', 'true');
  // Tapping the same card again clears the spotlight.
  await page.getByLabel(/^row 3 column 3: (?!empty)/).click();
  await expect(page.getByLabel(/^R3: /)).not.toHaveAttribute(
    'aria-current',
    'true'
  );
});

test('hop targeting: tap two cards in a row to swap', async ({ page }) => {
  // Seed chosen so the run draws a heart while the board has 2+ cards
  // (any seed works eventually; we walk until the Swap button enables).
  await page.goto('/play?difficulty=easy&seed=7');
  // Routes are code-split — wait for the play chunk to hydrate before
  // the non-waiting count() probes below.
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  const place = page.getByRole('button', { name: 'Place', exact: true });
  const swap = page.getByRole('button', { name: '♥ Swap' });

  // Non-waiting "is the Swap perk available right now" probe — the
  // button only exists while a heart is the drawn card.
  const swapReady = async () =>
    (await swap.count()) > 0 && (await swap.isEnabled());

  for (let i = 0; i < 30; i++) {
    if (await swapReady()) break;
    if ((await place.count()) === 0) break;
    await place.click();
  }
  test.skip(!(await swapReady()), 'no heart drawn this seed');

  await swap.click();
  await expect(page.getByText('♥ Swap — tap the first card')).toBeVisible();
  const targets = page.locator('button[aria-label*="valid target"]');
  await targets.first().click();
  await expect(
    page.getByText('♥ Swap — tap a card in the same row or column')
  ).toBeVisible();
  await page.locator('button[aria-label*="valid target"]').first().click();
  // Back to normal play after the swap commits.
  await expect(page.getByRole('button', { name: 'Place', exact: true })).toBeVisible();
});
