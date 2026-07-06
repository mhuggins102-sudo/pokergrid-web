/// <reference lib="dom" />
// The e2e project (tsconfig.node.json) builds without the DOM lib; this
// spec's page.evaluate() callbacks run in the browser and need DOM types.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Gameplay spacing regression guard.
 *
 * Every recent gameplay-spacing tweak was eyeballed, so the same three
 * spots kept getting re-nudged. This spec pins the spacing that is
 * SUPPOSED to be symmetric to rendered pixels, and records (without
 * asserting) the spacing that is deliberately asymmetric — the optical
 * nudges — so a future edit that disturbs either shows up as a diff in
 * the logged MEASUREMENTS block rather than a vibe.
 *
 * Selectors lean on CSS-module local names, which Vite preserves as a
 * substring of the hashed class (`_scoreSlot_ab12`), plus the board's
 * stable ARIA role. Runs at both configured viewports (mobile-390,
 * desktop-1280) automatically.
 */

const SEEDED_GAME = '/play?difficulty=easy&seed=42';
const OUT = process.env.SPACING_OUT ?? 'e2e-out/spacing';

/** Read layout/box geometry + computed spacing for the gameplay screen. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const round = (n: number) => Math.round(n * 100) / 100;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: round(r.top), bottom: round(r.bottom), height: round(r.height) };
    };
    const visible = (el: Element) =>
      getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    const pad = (el: Element) => {
      const s = getComputedStyle(el);
      return {
        top: parseFloat(s.paddingTop),
        bottom: parseFloat(s.paddingBottom),
        rowGap: s.rowGap === 'normal' ? 0 : parseFloat(s.rowGap),
        display: s.display,
      };
    };
    /** Vertical gaps between consecutive *visible* direct children. */
    const childGaps = (el: Element | null) => {
      if (!el) return [];
      const kids = Array.from(el.children).filter(visible);
      const gaps: number[] = [];
      for (let i = 1; i < kids.length; i++) {
        gaps.push(round(kids[i].getBoundingClientRect().top - kids[i - 1].getBoundingClientRect().bottom));
      }
      return gaps;
    };
    const pick = (sel: string) => document.querySelector(sel);

    const board = document.querySelector('[role="grid"][aria-label="Game board"]');
    const layout = board?.closest('[class*="layout"]') ?? null;
    const scoreBar = pick('[class*="scoreSlot"] > *');
    const boardArea = board?.closest('[class*="boardArea"]') ?? null;
    // Measure centering of the whole board FRAME (board + line rails), not
    // the bare 5×5 grid — with rails on, the grid sits at the top of the
    // frame and the bottom rail hangs below it, so the grid alone reads
    // off-center even when the frame is perfectly centered.
    const boardFrame = board?.closest('[class*="boardFrame"]') ?? null;
    // The dock is the layout's direct child whose class carries "dock"
    // (the dockClassic/dockStage modifiers live on `layout` itself).
    const dock = layout
      ? (Array.from(layout.children).find(c => /_dock_/.test((c as HTMLElement).className)) ?? null)
      : null;
    const linesPanelEl = pick('[class*="linesSlot"] [class*="panel"]');
    const linesPanel = linesPanelEl && visible(linesPanelEl) ? linesPanelEl : null;

    const layoutPad = layout ? pad(layout) : null;

    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      // On mobile the layout is a flex COLUMN (one vertical rhythm); on
      // desktop it's a 3-col GRID (siblings sit side by side, so
      // between-child vertical gaps are meaningless — flagged by display).
      layout: layoutPad
        ? { display: layoutPad.display, rowGap: layoutPad.rowGap, renderedGaps: childGaps(layout) }
        : null,
      // ScoreBar: top/bottom padding should match (symmetric pill).
      scoreBar: scoreBar ? pad(scoreBar) : null,
      // Dock: DELIBERATELY asymmetric (thumb zone / hand-stack 8-4 split) —
      // recorded, not asserted.
      dock: dock ? pad(dock) : null,
      // Board frame centered in its flexible area (equal slack above/below).
      boardCentering:
        boardFrame && boardArea
          ? {
              above: round(box(boardFrame).top - box(boardArea).top),
              below: round(box(boardArea).bottom - box(boardFrame).bottom),
            }
          : null,
      // LinesPanel (desktop only, null when hidden): gap below the heading
      // vs between rows. These SHOULD be equal — a mismatch is the
      // double-spacing bug.
      linesPanel: linesPanel
        ? { rowGap: pad(linesPanel).rowGap, renderedGaps: childGaps(linesPanel) }
        : null,
    };
  });
}

test('gameplay spacing is symmetric where intended', async ({ page }, testInfo) => {
  await page.goto(SEEDED_GAME);
  await expect(page.getByRole('grid', { name: 'Game board' })).toBeVisible();
  await expect(page.getByText('/ 400')).toBeVisible();
  // Let the ResizeObserver settle the board width before measuring.
  await page.waitForTimeout(300);

  const m = await measure(page);
  const tag = testInfo.project.name;
  // Surface the full measurement block — this IS the audit evidence,
  // readable in CI output, the HTML report, and a JSON artifact.
  testInfo.annotations.push({ type: 'measurements', description: JSON.stringify(m, null, 2) });
  console.log(`\n=== SPACING MEASUREMENTS [${tag}] ===\n${JSON.stringify(m, null, 2)}\n`);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/measurements-${tag}.json`, JSON.stringify(m, null, 2));
  await page.screenshot({ path: `${OUT}/gameplay-${tag}.png`, fullPage: false });

  // ---- Invariants that must hold (symmetric-by-design spacing) ----

  // 1. On the mobile flex column, every gap between stacked sections
  //    equals the layout's own rowGap — one rhythm, no section spaced
  //    differently from its neighbors. (Skipped for the desktop grid.)
  if (m.layout && m.layout.display === 'flex') {
    for (const g of m.layout.renderedGaps) {
      expect(Math.abs(g - m.layout.rowGap)).toBeLessThanOrEqual(1);
    }
  }

  // 2. ScoreBar top/bottom padding match (symmetric pill).
  if (m.scoreBar) {
    expect(Math.abs(m.scoreBar.top - m.scoreBar.bottom)).toBeLessThanOrEqual(0.5);
  }

  // 3. The board frame sits centered in its flexible area (equal slack
  //    above/below). Only meaningful when the area actually flexes around
  //    it — the mobile column; the desktop grid gives the board its own
  //    track, so skip when there's no vertical slack to split.
  if (m.boardCentering && m.layout?.display === 'flex') {
    expect(Math.abs(m.boardCentering.above - m.boardCentering.below)).toBeLessThanOrEqual(2);
  }

  // 4. LinesPanel (desktop): the space below the heading equals the space
  //    between rows — no child adds its own margin on top of the panel gap.
  //    This is the fix for the heading double-spacing bug.
  if (m.linesPanel && m.linesPanel.renderedGaps.length > 0) {
    for (const g of m.linesPanel.renderedGaps) {
      expect(Math.abs(g - m.linesPanel.rowGap)).toBeLessThanOrEqual(1);
    }
  }
});
