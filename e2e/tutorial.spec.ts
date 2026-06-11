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
  const place = page.getByRole('button', { name: 'Place', exact: true });

  // Step 1 — welcome. The board is inert: Place is blocked and nudges.
  await expect(coach).toContainText('Welcome to PokerGrid');
  await place.click();
  await expect(page.getByText('Read the coach card')).toBeVisible();
  await expect(coach).toContainText('Welcome to PokerGrid');
  await coach.getByRole('button', { name: 'Next' }).click();

  // Steps 2-4 — three guided places.
  await expect(coach).toContainText('Place your first card');
  await place.click();
  await expect(coach).toContainText('Keep the spiral going');
  await place.click();
  await expect(coach).toContainText('A second king');
  await place.click();

  // Step 5 — perks intro.
  await expect(coach).toContainText('Every suit is a power');
  await coach.getByRole('button', { name: 'Next' }).click();

  // Step 6 — ♥ swap: K♦ (slot 17 = row 4 col 3) ↔ 4♣ (slot 18 = row 4 col 4).
  await expect(coach).toContainText('♥ Swap');
  await page.getByRole('button', { name: '♥ Swap' }).click();
  await page.getByLabel(/row 4 column 3: K of diamonds/i).click();
  await page.getByLabel(/row 4 column 4: 4 of clubs/i).click();

  // Step 7 — place the 2♣ (lands at slot 16).
  await expect(coach).toContainText('A dud card');
  await place.click();

  // Step 8 — ♦ destroy the 2♣ (row 4 col 2).
  await expect(coach).toContainText('♦ Destroy');
  await page.getByRole('button', { name: '♦ Destroy' }).click();
  await page.getByLabel(/row 4 column 2: 2 of clubs/i).click();

  // Step 9 — ♠ slide the 4♣ (the swap moved it to slot 17 = row 4
  // col 3) into the reopened gap at row 4 col 2.
  await expect(coach).toContainText('♠ Slide');
  await page.getByRole('button', { name: '♠ Slide' }).click();
  await page.getByLabel(/row 4 column 3: 4 of clubs/i).click();
  await page.getByLabel(/row 4 column 2: empty/i).click();

  // Step 10 — ♣ bonus: draw two, keep the first.
  await expect(coach).toContainText('♣ Bonus');
  await page.getByRole('button', { name: '♣ Bonus' }).click();
  await page
    .getByRole('button', { name: /tap to keep/i })
    .first()
    .click();

  // Step 11 — joker recap (it auto-placed during the draw).
  await expect(coach).toContainText('The joker is wild');
  await expect(page.getByLabel(/row 4 column 3: Joker/i)).toBeVisible();
  await coach.getByRole('button', { name: 'Next' }).click();

  // Step 12 — discard the 2♦.
  await expect(coach).toContainText('let it go');
  await page.getByRole('button', { name: 'Discard', exact: true }).click();

  // Step 13 — scoring recap, then the free tail dismisses the coach.
  await expect(coach).toContainText('How scoring works');
  await coach.getByRole('button', { name: 'Next' }).click();
  await expect(coach).toContainText('on your own');
  await coach.getByRole('button', { name: 'Got it' }).click();
  await expect(coach).toHaveCount(0);

  // Free play is live again — Place works normally.
  await expect(place).toBeEnabled();
  await place.click();
});
