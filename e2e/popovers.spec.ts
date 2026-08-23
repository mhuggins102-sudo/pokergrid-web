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

// The intro tour overlays a fresh profile's first game (covered by
// introTour.spec.ts) — pre-mark it seen so the in-game popover cases
// start with a clear screen.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pokergrid:intro-tour:v1', 'seen');
  });
});

test('mobile header: the hamburger drawer opens and routes into Daily', async ({
  page,
}, testInfo) => {
  const vp = page.viewportSize();
  test.skip(
    !testInfo.project.use.hasTouch || !vp || vp.width >= 768,
    'phone header drawer is the <768 touch case'
  );

  await page.goto('/');
  // The links row is gone on phone — the hamburger left of the wordmark
  // opens the nav drawer (a native <dialog>, so plain visibility
  // assertions work; no opacity polling needed).
  const menuBtn = page.getByRole('button', { name: 'Menu' });
  await expect(menuBtn).toBeVisible();
  await menuBtn.tap();

  const daily = page.getByRole('dialog').getByRole('link', { name: 'Daily' });
  await expect(daily).toBeVisible();

  // Tapping Daily navigates and closes the drawer.
  await daily.tap();
  await expect(page).toHaveURL(/\/daily$/);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('mobile drawer: ident tap shows level progress; a right swipe closes it', async ({
  page,
}, testInfo) => {
  const vp = page.viewportSize();
  test.skip(
    !testInfo.project.use.hasTouch || !vp || vp.width >= 768,
    'phone header drawer is the <768 touch case'
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).tap();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: 'Daily' })).toBeVisible();

  // The ident (Level + XP block) opens the progress-to-next-level
  // popover on tap. Locate the tooltip node itself: the text rows'
  // own classes contain "Pop", which would stop popOpacity's closest()
  // walk at a child whose OWN opacity is always 1.
  const pop = dialog.locator('[role="tooltip"]');
  const ident = dialog.getByRole('button', { name: /Level \d/ });
  await expect(pop).toContainText(/XP to Level|Max level/);
  expect(await popOpacity(pop)).toBe(0);
  await ident.tap();
  await expect.poll(() => popOpacity(pop)).toBe(1);

  // Tapping the ident again toggles it closed (touch emulates
  // mouseenter — the hover half of the union must not pin it open).
  await ident.tap();
  await expect.poll(() => popOpacity(pop)).toBe(0);

  // Reopened, it dismisses itself after ~2.5s while the drawer stays.
  await ident.tap();
  await expect.poll(() => popOpacity(pop)).toBe(1);
  await expect
    .poll(() => popOpacity(pop), { timeout: 5000 })
    .toBe(0);
  await expect(dialog.getByRole('link', { name: 'Daily' })).toBeVisible();

  // Swipe the panel rightward — the dismiss drag slides it out and
  // closes the drawer. Synthetic TouchEvents drive Dialog's native
  // listeners directly (Playwright's touchscreen has no drag).
  await dialog.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const x0 = rect.left + 40;
    const y0 = rect.top + rect.height / 2;
    const fire = (type: string, x: number) => {
      const touch = new Touch({
        identifier: 1,
        target: el,
        clientX: x,
        clientY: y0,
      });
      el.dispatchEvent(
        new TouchEvent(type, {
          touches: type === 'touchend' ? [] : [touch],
          changedTouches: [touch],
          bubbles: true,
          cancelable: true,
        })
      );
    };
    fire('touchstart', x0);
    for (let i = 1; i <= 6; i++) fire('touchmove', x0 + i * 25);
    fire('touchend', x0 + 150);
  });
  await expect(dialog).toBeHidden();
});

test('mobile challenges: medal popover re-opens right after a scroll dismissal', async ({
  page,
}, testInfo) => {
  const vp = page.viewportSize();
  test.skip(
    !testInfo.project.use.hasTouch || !vp || vp.width >= 768,
    'touch popover machinery is the <768 touch case'
  );

  await page.goto('/challenges');
  const wrap = page.locator('[class*="medalTallyWrap"]');
  const pop = page
    .locator('[role="tooltip"]')
    .filter({ hasText: 'Trophy tiers' });
  await wrap.tap();
  await expect.poll(() => popOpacity(pop)).toBe(1);

  // Dismiss by SCROLLING (a real touch drag via CDP — pointerdown with
  // no click). This used to leave the provider's click-swallow armed
  // for 700ms, eating the next genuine tap anywhere in the app.
  const cdp = await page.context().newCDPSession(page);
  const pt = (x: number, y: number) => [{ x, y }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: pt(200, 600),
  });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: pt(200, 600 - i * 50),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect.poll(() => popOpacity(pop)).toBeLessThan(1);

  // The immediate re-tap must open the popover again.
  await wrap.tap();
  await expect.poll(() => popOpacity(pop)).toBe(1);
});

test('mobile streamlined game: the wordmark exits home mid-game', async ({
  page,
}, testInfo) => {
  const vp = page.viewportSize();
  test.skip(
    !testInfo.project.use.hasTouch || !vp || vp.width >= 768,
    'streamlined phone game is the <768 touch case'
  );

  // Pre-set the streamlined column preview before any app script runs, so
  // the running game re-homes its details row into the phone header.
  await page.addInitScript(() => {
    localStorage.setItem(
      'pokergrid:settings:v1',
      JSON.stringify({ state: { streamlinedColumn: true }, version: 0 })
    );
  });

  await page.goto('/play?difficulty=easy&seed=42');
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();

  // Regression: the game-details row used to churn identity every render,
  // which re-fired its re-home effect into an unbounded loop that pegged
  // the main thread and swallowed header taps — so no header link ever
  // navigated during a streamlined game. The wordmark (the phone header's
  // home affordance since the HOME icon was retired) must route to '/'.
  const wordmark = page.getByRole('link', { name: 'PokerGrid' });
  await expect(wordmark).toBeVisible();
  await wordmark.tap();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe('/');
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
