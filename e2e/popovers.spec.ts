/// <reference lib="dom" />
// The e2e project (tsconfig.node.json) builds without the DOM lib; the
// evaluate() callbacks below run in the browser and need DOM types.
import { expect, test, type Locator } from '@playwright/test';

/**
 * Touch tap-equivalents (unification phase 6, decision E). The hover /
 * :focus-within popovers gain a tap-to-toggle on coarse pointers via the
 * TapPopover primitive. These cases are TOUCH-ONLY — they skip on the
 * fine-pointer desktop project — and each is gated to the viewport whose
 * surface it exercises (the phone header row; the landscape desk game).
 *
 * Closed popovers stay in the DOM at opacity 0 (Playwright treats those
 * as "visible"), so open/closed is asserted through computed opacity of
 * the popover, not toBeVisible().
 */

/** Computed opacity of the popover enclosing the located text. */
const popOpacity = (loc: Locator): Promise<number> =>
  loc.evaluate(node => {
    const pop =
      (node as HTMLElement).closest('[role="tooltip"], [class*="Menu"], [class*="Pop"]') ??
      node;
    return Number(getComputedStyle(pop as Element).opacity);
  });

test('mobile header: Game Modes taps open and route into Daily', async ({
  page,
}, testInfo) => {
  const vp = page.viewportSize();
  test.skip(
    !testInfo.project.use.hasTouch || !vp || vp.width >= 768,
    'phone header row is the <768 touch case'
  );

  await page.goto('/');
  const trigger = page.getByText('Game Modes');
  await expect(trigger).toBeVisible();
  const daily = page.locator('header').getByRole('link', { name: 'Daily' });

  // Tap opens the dropdown (menu opacity → 1, so the item is tappable).
  await trigger.tap();
  await expect.poll(() => popOpacity(daily)).toBeGreaterThan(0.5);

  // Tapping Daily navigates and the menu closes (route-change dismissal).
  await daily.tap();
  await expect(page).toHaveURL(/\/daily$/);
  await expect.poll(() => popOpacity(daily)).toBeLessThan(0.5);
});

test('desk game: deck peek + scoring ⓘ are tap-toggled and single-open', async ({
  page,
}, testInfo) => {
  const vp = page.viewportSize();
  test.skip(
    !testInfo.project.use.hasTouch || !vp || vp.width < 768 || vp.height >= vp.width,
    'desk-lite / desk touch game is the landscape ≥768 touch case'
  );

  await page.goto('/play?difficulty=easy&seed=42');
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  await expect(page.getByText('/ 400')).toBeVisible();

  const peekHead = page.getByText(/Deck peek ·/);
  // Scoped to the Scoring panel — the always-mounted HandValuesDialog
  // overlay carries the same penalty label.
  const handsPenalty = page
    .getByRole('region', { name: 'Scoring' })
    .getByText('Unfinished line at game end');

  // Tap the deck well → its peek popover opens.
  await page.getByText(/^Deck ·/).tap();
  await expect.poll(() => popOpacity(peekHead)).toBeGreaterThan(0.5);

  // Tap the scoring ⓘ → hands popover opens AND the peek closes
  // (single-open registry).
  await page.getByRole('button', { name: 'Hand values' }).tap();
  await expect.poll(() => popOpacity(handsPenalty)).toBeGreaterThan(0.5);
  await expect.poll(() => popOpacity(peekHead)).toBeLessThan(0.5);

  // Commit a Place → every open popover dismisses (game-commit hook).
  await page.getByRole('button', { name: 'Place', exact: true }).tap();
  await expect.poll(() => popOpacity(handsPenalty)).toBeLessThan(0.5);
});
