import { expect, test } from '@playwright/test';

/**
 * The intro tour: the paged how-to-play overlay that appears over a
 * fresh profile's first game (it replaced the interactive /tutorial).
 * Fresh storage IS a fresh profile here, so no seeding — the other
 * gameplay specs pre-mark the tour seen to keep their screens clear.
 *
 * Dismissal contract: finishing (reaching the last page) or ticking
 * "Don't show this again" persists 'seen'; the ✕ closes for the
 * current game only, so a reload brings the tour back.
 */

const SEEDED_GAME = '/play?difficulty=easy&seed=1';

test('first game shows the tour; finishing it dismisses for good', async ({
  page,
}) => {
  await page.goto(SEEDED_GAME);

  const tour = page.getByRole('dialog', { name: 'How to play PokerGrid' });
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('1 / 6');
  await expect(tour).toContainText('Build 10 poker hands at once');

  // Page forward through all six pages; ▶ gives way to the primary
  // "Start playing" CTA on the last one.
  const next = tour.getByRole('button', { name: 'Next page' });
  for (let i = 2; i <= 6; i++) {
    await next.click();
    await expect(tour).toContainText(`${i} / 6`);
  }
  await expect(tour).toContainText('Keep exploring');

  // ◀ pages back too.
  await tour.getByRole('button', { name: 'Previous page' }).click();
  await expect(tour).toContainText('5 / 6');
  await tour.getByRole('button', { name: 'Next page' }).click();

  // Reaching the end marked the tour seen — the checkbox reflects it.
  await expect(tour.getByRole('checkbox')).toBeChecked();
  await tour.getByRole('button', { name: 'Start playing' }).click();
  await expect(tour).toHaveCount(0);

  // The game underneath is live.
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Place', exact: true })
  ).toBeVisible();

  // Finished = seen: a fresh load of another game shows no tour.
  await page.goto(SEEDED_GAME);
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  await expect(tour).toHaveCount(0);
});

test('the ✕ closes for this game only — the tour returns next game', async ({
  page,
}) => {
  await page.goto(SEEDED_GAME);

  const tour = page.getByRole('dialog', { name: 'How to play PokerGrid' });
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Close' }).click();
  await expect(tour).toHaveCount(0);

  // No flag was written — the next game shows the tour again.
  await page.goto(SEEDED_GAME);
  await expect(tour).toBeVisible();

  // Ticking "Don't show this again" persists even through an ✕ close.
  await tour.getByRole('checkbox').check();
  await tour.getByRole('button', { name: 'Close' }).click();
  await page.goto(SEEDED_GAME);
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  await expect(tour).toHaveCount(0);
});
