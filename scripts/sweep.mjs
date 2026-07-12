/**
 * Screenshot sweep — the mobile/tablet unification program's regression
 * instrument (plan: piped-sparking-sparrow, Phase 1).
 *
 * Shoots every route plus a seeded mid-game board at the four reference
 * viewports (phone 390, tablet 820, desktop threshold 1024, desktop
 * 1280) with reduced motion, into stable file names. Each phase runs it
 * twice — once at the base commit, once with the phase's changes — and
 * diffs the two trees (`cmp`) against that phase's declared
 * "allowed to change" route list. Phase 1's bar: every image
 * byte-identical.
 *
 * Usage:
 *   node scripts/sweep.mjs --out <dir> [--base http://localhost:4173]
 *
 * Expects a production preview server already running (from the repo
 * root: `npm run build && npx vite preview --port 4173 --strictPort`).
 * Chromium resolution honours PLAYWRIGHT_CHROMIUM_PATH the same way
 * playwright.config.ts does (managed containers ship a system build).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = argOf('--out', null);
const BASE = argOf('--base', 'http://localhost:4173');
if (!OUT) {
  console.error('usage: node scripts/sweep.mjs --out <dir> [--base <url>]');
  process.exit(1);
}

/** name → path. Names are stable so before/after trees can be cmp'd. */
const ROUTES = [
  ['home', '/'],
  ['daily', '/daily'],
  ['daily-archive', '/daily/archive'],
  ['play', '/play'],
  ['challenges', '/challenges'],
  ['targets', '/targets'],
  ['stats', '/stats'],
  ['achievements', '/achievements'],
  ['rules', '/rules'],
  ['rules-cards', '/rules/cards'],
  ['settings', '/settings'],
];

/** The plan's four reference viewports. */
const VIEWPORTS = [
  ['390x844', { width: 390, height: 844 }],
  ['820x1180', { width: 820, height: 1180 }],
  ['1024x768', { width: 1024, height: 768 }],
  ['1280x800', { width: 1280, height: 800 }],
];

const SEEDED_GAME = '/play?difficulty=easy&seed=42';

/** Deterministic settle: fonts loaded, network quiet, layout at rest. */
async function settle(page) {
  await page
    .waitForLoadState('networkidle', { timeout: 5_000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  // Let ResizeObserver-driven board sizing and any trailing rAF work
  // finish (reduced motion collapses the long animations already).
  await page.waitForTimeout(400);
}

async function shoot(page, file) {
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
}

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch(
  chromiumPath ? { executablePath: chromiumPath } : {}
);

mkdirSync(OUT, { recursive: true });
let count = 0;

for (const [vpName, viewport] of VIEWPORTS) {
  // Fresh context per viewport: empty storage (first-visit states are
  // part of the sweep), reduced motion, stable scale factor.
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const [name, path] of ROUTES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    await settle(page);
    await shoot(page, `${OUT}/${name}--${vpName}.png`);
    count++;
  }

  // Seeded mid-game: a couple of Places into the deterministic easy
  // run — exercises the in-game layout (board, dock, rails/panels).
  await page.goto(`${BASE}${SEEDED_GAME}`, { waitUntil: 'load' });
  await page
    .getByRole('grid', { name: 'Game board' })
    .waitFor({ timeout: 10_000 });
  await settle(page);
  const place = page.getByRole('button', { name: 'Place', exact: true });
  for (let i = 0; i < 2; i++) {
    await place.click();
    await page.waitForTimeout(250);
  }
  await settle(page);
  await shoot(page, `${OUT}/game-mid--${vpName}.png`);
  count++;

  await context.close();
}

await browser.close();
console.log(`sweep: wrote ${count} screenshots to ${OUT}`);
