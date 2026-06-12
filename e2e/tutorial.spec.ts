import { expect, test } from '@playwright/test';

/**
 * Walks the guided portion of /tutorial end to end: every scripted
 * move on the handcrafted deal, with the coach advancing step by step
 * and blocked inputs nudging instead of acting.
 */
test('tutorial guides the scripted opening and releases into free play', async ({
  page,
}) => {
  await page.goto('/tutorial');

  const coach = page.getByLabel('Tutorial coach');
  const next = coach.getByRole('button', { name: 'Next' });
  const place = page.getByRole('button', { name: 'Place', exact: true });

  // Welcome + target intros. The board is inert: Place is blocked and
  // nudges instead of acting.
  await expect(coach).toContainText('Welcome to PokerGrid');
  await place.click();
  await expect(page.getByText('Read the coach card')).toBeVisible();
  await expect(coach).toContainText('Welcome to PokerGrid');
  await next.click();
  await expect(coach).toContainText('The practice target');
  await next.click();

  // Three guided places.
  await expect(coach).toContainText('Place your first card');
  await place.click();
  await expect(coach).toContainText('Keep the spiral going');
  await place.click();
  await expect(coach).toContainText('A second king');
  await place.click();

  // Perks intro.
  await expect(coach).toContainText('Every suit is a power');
  await next.click();

  // ♥ swap: K♦ (slot 17 = row 4 col 3) ↔ 4♣ (slot 18 = row 4 col 4).
  await expect(coach).toContainText('♥ Swap');
  await page.getByRole('button', { name: '♥ Swap' }).click();
  await page.getByLabel(/row 4 column 3: K of diamonds/i).click();
  await page.getByLabel(/row 4 column 4: 4 of clubs/i).click();

  // Place the 2♣ (lands at slot 16).
  await expect(coach).toContainText('A dud card');
  await place.click();

  // ♦ destroy the 2♣ (row 4 col 2), then the spiral-backfill recap.
  await expect(coach).toContainText('♦ Destroy');
  await page.getByRole('button', { name: '♦ Destroy' }).click();
  await page.getByLabel(/row 4 column 2: 2 of clubs/i).click();
  await expect(coach).toContainText('The spiral backfills');
  await next.click();

  // ♠ slide the 4♣ (the swap moved it to slot 17 = row 4 col 3) into
  // the reopened gap at row 4 col 2.
  await expect(coach).toContainText('♠ Slide');
  await page.getByRole('button', { name: '♠ Slide' }).click();
  await page.getByLabel(/row 4 column 3: 4 of clubs/i).click();
  await page.getByLabel(/row 4 column 2: empty/i).click();

  // ♣ bonus: draw two, keep the first.
  await expect(coach).toContainText('♣ Bonus');
  await page.getByRole('button', { name: '♣ Bonus' }).click();
  await page
    .getByRole('button', { name: /tap to keep/i })
    .first()
    .click();

  // Joker recaps (it auto-placed during the draw).
  await expect(coach).toContainText('The joker is wild');
  await expect(page.getByLabel(/row 4 column 3: Joker/i)).toBeVisible();
  await next.click();
  await expect(coach).toContainText('A shape-shifter');
  await next.click();

  // Discard the 2♦.
  await expect(coach).toContainText('let it go');
  await page.getByRole('button', { name: 'Discard', exact: true }).click();

  // Closing recaps, then the free tail dismisses the coach.
  await expect(coach).toContainText('How the game ends');
  await next.click();
  await expect(coach).toContainText('What hands pay');
  await next.click();
  await expect(coach).toContainText('Your dashboards');
  await next.click();
  await expect(coach).toContainText('Your bonus hand');
  await next.click();
  await expect(coach).toContainText('Watch the deck');
  await next.click();
  await expect(coach).toContainText('on your own');
  await coach.getByRole('button', { name: 'Got it' }).click();
  await expect(coach).toHaveCount(0);

  // Free play is live again — Place works normally.
  await expect(place).toBeEnabled();
  await place.click();
});
