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
 * stable ARIA role. Runs at every configured viewport (mobile-390,
 * tablet-820, desktop-1280) automatically.
 */

const SEEDED_GAME = '/play?difficulty=easy&seed=42';
const OUT = process.env.SPACING_OUT ?? 'e2e-out/spacing';

// The intro tour overlays a fresh profile's first game (covered by
// introTour.spec.ts) — pre-mark it seen so the measured screen is the
// bare gameplay surface.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pokergrid:intro-tour:v1', 'seen');
  });
});

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

    const layoutPad = layout ? pad(layout) : null;

    // ---- Visible-INK gaps (phone): what the eye actually measures. ----
    // The info row's box bottom lies 3–6px below its chips' borders (it
    // carries the header's padding), and the borderless merged bonus
    // strip's first ink sits inside its own padding — so box symmetry
    // and visible symmetry differ. Ink edge = min/max over descendants
    // that draw a border/background/text, bounded to the root's box
    // (anchored popovers escape it).
    const drawsInk = (el: Element) => {
      const s = getComputedStyle(el);
      return (
        s.borderTopWidth !== '0px' ||
        s.borderBottomWidth !== '0px' ||
        (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') ||
        (el.childElementCount === 0 && (el.textContent ?? '').trim() !== '')
      );
    };
    const inkEdge = (root: Element, side: 'top' | 'bottom') => {
      const b0 = root.getBoundingClientRect();
      let v = side === 'top' ? Infinity : -Infinity;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const b = el.getBoundingClientRect();
        if (b.height <= 0 || b.top < b0.top - 1 || b.bottom > b0.bottom + 1 || !drawsInk(el))
          continue;
        v = side === 'top' ? Math.min(v, b.top) : Math.max(v, b.bottom);
      }
      return Number.isFinite(v) ? v : side === 'top' ? b0.top : b0.bottom;
    };
    // `_gameRow_` (hashed module class) — NOT `.bar.gameRowActive`, whose
    // class list also contains the substring "gameRow".
    const gameRow = pick('[class*="_gameRow_"]');
    let inkCentering: { above: number; below: number } | null = null;
    if (gameRow && visible(gameRow) && boardFrame && layout) {
      // Dock cluster: topmost layout child below the frame. Split's
      // panels are bordered at the cluster box; the strip/dock wrappers
      // are borderless, so their ink starts at descendants.
      let cluster: Element | null = null;
      let clusterTop = Infinity;
      const frameBottom = boardFrame.getBoundingClientRect().bottom;
      for (const c of Array.from(layout.children)) {
        if (c === boardArea) continue;
        const b = c.getBoundingClientRect();
        if (b.height > 0 && b.top > frameBottom - 1 && b.top < clusterTop) {
          clusterTop = b.top;
          cluster = c;
        }
      }
      if (cluster) {
        const clusterInk = /dtWrap/.test((cluster as HTMLElement).className)
          ? cluster.getBoundingClientRect().top
          : inkEdge(cluster, 'top');
        inkCentering = {
          above: round(inkEdge(boardFrame, 'top') - inkEdge(gameRow, 'bottom')),
          below: round(clusterInk - inkEdge(boardFrame, 'bottom')),
        };
      }
    }

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
      // Phone only (needs the in-game header row): the visible ink gaps
      // around the board — the user-facing symmetry the nudges target.
      inkCentering,
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

  // 1. The column game's between-section gaps are RECORDED, not asserted
  //    uniform: the streamlined column (now the only column-family game)
  //    is deliberately non-uniform — the bonus strip sits flush against
  //    the dock (0 gap) and carries a small breathing gap above it, so a
  //    single-rowGap rhythm no longer describes it. Board-centering (#3)
  //    is the symmetric-by-design assertion; the gaps live in the logged
  //    MEASUREMENTS block so a future edit that disturbs them shows up as
  //    a diff there. Guard only that no gap is a runaway void.
  if (m.layout && m.layout.display === 'flex') {
    for (const g of m.layout.renderedGaps) {
      expect(g).toBeLessThanOrEqual(m.layout.rowGap + 12);
    }
  }

  // 2. ScoreBar top/bottom padding match (symmetric pill).
  if (m.scoreBar) {
    expect(Math.abs(m.scoreBar.top - m.scoreBar.bottom)).toBeLessThanOrEqual(0.5);
  }

  // 3. The board frame sits centered in its flexible area (equal slack
  //    above/below). Only meaningful when the area actually flexes around
  //    it — the column game; the desktop grid gives the board its own
  //    track, so skip when there's no vertical slack to split.
  //    EXCEPTION: the phone (<768) streamlined column deliberately nudges
  //    the board a few px within its area so it centers in the VISIBLE
  //    window (equal blank space above/below the grid) against fixed
  //    header vs dock chrome of unequal height — the user-facing goal.
  //    There it gets only a runaway guard (the exact nudge is in the
  //    logged MEASUREMENTS block); the tablet column keeps the tight ±2.
  if (m.boardCentering && m.layout?.display === 'flex') {
    const bound = m.viewport.w < 768 ? 14 : 2;
    expect(Math.abs(m.boardCentering.above - m.boardCentering.below)).toBeLessThanOrEqual(bound);
  }

  // 3b. Phone: the user-facing symmetry the nudges exist for — VISIBLE
  //     ink gaps (info-row chip borders → first cell; totals chips →
  //     first dock ink) match. Target sits at +1, not 0: the info-row
  //     buttons' drop shadow paints ~1px below their border box, so
  //     DOM-equal reads bottom-heavy on screen (band-scan calibrated —
  //     see the nudge comments in GameScreen.module.css).
  if (m.inkCentering && m.viewport.w < 768) {
    expect(Math.abs(m.inkCentering.above - m.inkCentering.below - 1)).toBeLessThanOrEqual(2);
  }

  // 4. Tablet game families (unification phase 5 landed the split, phase
  //    6 gave desk-lite the full three columns): in the tablet band
  //    (768–1023) the game keys on orientation — portrait renders the
  //    phone COLUMN (flex layout, no desk panels), landscape renders
  //    DESK-LITE, which is now the full three-column desk grid compressed
  //    (Scoring left rail present, just narrower — not dropped).
  if (m.viewport.w >= 768 && m.viewport.w < 1024) {
    const portrait = m.viewport.h > m.viewport.w;
    if (portrait) {
      // Column family: the phone flex layout, desk panels absent.
      expect(m.layout).not.toBeNull();
      expect(m.layout?.display).toBe('flex');
      await expect(
        page.getByRole('region', { name: 'Deck and actions' })
      ).toHaveCount(0);
      await expect(
        page.getByRole('region', { name: 'Scoring' })
      ).toHaveCount(0);
    } else {
      // Desk-lite family: the compressed three-column desk grid — no
      // phone .layout, the deck/actions right rail AND the Scoring left
      // rail both present.
      expect(m.layout).toBeNull();
      await expect(
        page.getByRole('region', { name: 'Deck and actions' })
      ).toHaveCount(1);
      await expect(
        page.getByRole('region', { name: 'Scoring' })
      ).toHaveCount(1);
    }
  }

  // 5. Desktop redesign (phase 2): at ≥1024px GameScreen renders the
  //    three-column desk fork INSTEAD of the mobile flex column, so the
  //    mobile-only measurements above are expected to come back null —
  //    assert the swap actually happened (desk panels present, mobile
  //    column absent) so this run still guards the breakpoint.
  if (m.viewport.w >= 1024) {
    expect(m.layout).toBeNull();
    await expect(
      page.getByRole('region', { name: 'Deck and actions' })
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Scoring' })).toBeVisible();
  }
});
