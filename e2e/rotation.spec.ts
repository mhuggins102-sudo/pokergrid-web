import { expect, test } from '@playwright/test';

/**
 * Rotation across the in-game family flip (unification phase 5). At the
 * tablet tier a device rotation crosses the column ↔ desk boundary live,
 * the same class of change the 1024px crossing was before — and it can
 * happen right after a run ends, mounting BOTH result surfaces (the
 * column ResultView and the DesktopResultDialog) across the flip. The
 * result-recording and Targets-Up ladder commits are guarded to a
 * single owner (keyed on the final GameState); this walks a real run to
 * a loss and flips the viewport to prove the flip stays coherent and
 * the ladder commits exactly once.
 */

// The Targets-Up L3 resume save. seed=11 is a known loss at level 3
// (target 450 — mirrors the progression unit test), so the run ends
// with "Run over at level 3". Seeded before the app boots so
// TargetsPlayPage snapshots level 3 at mount.
const TU_SAVE_L3 = JSON.stringify({
  state: { save: { level: 3, wins: 2 } },
  version: 0,
});

test('family flip mid-result records once', async ({ page }, testInfo) => {
  // Only the tablet-820 project starts in the portrait column and can
  // rotate across the family boundary; the fixed desktop/phone projects
  // never cross it.
  test.skip(
    testInfo.project.name !== 'tablet-820',
    'rotation is exercised only at the tablet tier'
  );

  await page.addInitScript(save => {
    localStorage.setItem('pokergrid:tu-save:v1', save);
  }, TU_SAVE_L3);

  await page.goto('/targets/play?seed=11');
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  await expect(page.getByText('/ 450')).toBeVisible();

  // Place to the end — jokers auto-place, so well under 30 presses ends
  // the run (the placeToEnd pattern from freeplay.spec).
  const place = page.getByRole('button', { name: 'Place', exact: true });
  for (let i = 0; i < 30; i++) {
    if (!(await place.isVisible().catch(() => false))) break;
    await place.click();
  }

  // At 820 (tablet portrait) the column family shows the full-screen
  // ResultView verdict.
  await expect(page.getByText(/Run over at level 3/i)).toBeVisible({
    timeout: 10_000,
  });

  // Rotate into the desktop tier (1180 wide): the SAME GameScreen flips
  // family live (column → desk), and the game-over surface becomes the
  // DesktopResultDialog — the finished board behind a scrim + verdict
  // card, opened by default. Its verdict names the same lost level.
  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(page.getByText(/Run ended.*level 3/i)).toBeVisible({
    timeout: 10_000,
  });

  // Committed exactly once: the loss cleared the ladder save
  // (useTargetsResult's single-owner guard survived the flip mounting
  // both surfaces). The persisted save resolved to null — the lost
  // state — and stats carry no spurious free-play row.
  const state = await page.evaluate(() => ({
    tuSave: JSON.parse(localStorage.getItem('pokergrid:tu-save:v1') ?? 'null'),
    stats: JSON.parse(localStorage.getItem('pokergrid:stats:v1') ?? 'null'),
  }));
  expect(state.tuSave?.state?.save ?? null).toBeNull();
  // A targets loss records no run row (recordTargetsUp fires on wins
  // only) — a double-commit that mis-recorded it would surface here.
  expect(state.stats?.state?.stats?.recent ?? []).toHaveLength(0);

  // Rotate back to portrait: the column ResultView returns — still one
  // coherent result, no crash, no doubled surface.
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByText(/Run over at level 3/i)).toBeVisible({
    timeout: 10_000,
  });
});
