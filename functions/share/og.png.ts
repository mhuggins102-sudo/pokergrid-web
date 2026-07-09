// GET /share/og.png?score=...&mode=...&diff=...&grid=<50-char encoding>
//
// Generates the 1200×630 share card image referenced by the /share page's
// og:image meta tag. Link-preview clients (iMessage, Slack, Discord, Twitter)
// fetch this directly when they unfurl a shared PokerGrid URL.
//
// Rendered with workers-og — Satori under the hood, no headless browser. The
// engine accepts an HTML string (not JSX), so we build the markup as a
// template literal with inline styles. Layout must obey Satori's flex-only
// constraint: every element that contains more than one child needs an
// explicit `display: flex` (and almost everything does, even leaf <div>s
// containing text, to satisfy the renderer).

import { ImageResponse } from 'workers-og';
import {
  CellCode,
  ModeLabel,
  formatShareDate,
  parseShare,
  Rank,
  Suit,
} from './_shared';

// ---- Theme (mirrors src/ui/theme.ts) -----------------------------------------

// "Morning Paper" DARK palette — mirrors [data-theme='paper-dark'] in
// src/design/tokens.css (the site's default look for new players).
// Card faces stay cream with the light-ink suit colors, exactly like
// the in-game dark theme.
const COLOR = {
  bgBase: '#17150f',
  bgPanel: '#211e17',
  bgSunken: '#100e09',
  cardFace: '#f6f1e4',
  outline: '#3a352a',
  textHi: '#efe9d8',
  textMid: '#b7ae9b',
  textLow: '#948b77',
  accent: '#3a8f68',
  joker: '#a78bdb',
  suitH: '#b3262e',
  suitS: '#1f2937',
  suitD: '#1d5fa0',
  suitC: '#2f7d4f',
};

const SUIT_COLOR: Record<Suit, string> = {
  H: COLOR.suitH,
  S: COLOR.suitS,
  D: COLOR.suitD,
  C: COLOR.suitC,
};
const rankDisplay = (r: Rank): string => (r === 'T' ? '10' : r);

// ---- HTML builders -----------------------------------------------------------

const cellHtml = (cell: CellCode | null): string => {
  // Empty: a sunken slot with the dashed rule, like the in-game board.
  if (!cell) {
    return `<div style="display:flex;width:80px;height:80px;border-radius:6px;background:${COLOR.bgSunken};border:1px dashed ${COLOR.outline}"></div>`;
  }
  // Joker — Satori's default font doesn't ship the suit glyphs ♥♠♦♣ or the
  // filled-star ★, so we render "JK" in the violet joker color (same letters
  // the in-game card uses for screen readers / accessibility).
  if (cell.kind === 'joker') {
    return `<div style="display:flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:6px;background:${COLOR.cardFace};border:2px solid ${COLOR.joker};box-shadow:0 1px 2px rgba(0,0,0,0.35);color:${COLOR.joker};font-family:monospace;font-size:34px;font-weight:800;line-height:1;letter-spacing:1px">JK</div>`;
  }
  // Standard card: rank only, vertically + horizontally centered, printed
  // in the suit's ink on the cream face — flat, no glow (Morning Paper).
  const sc = SUIT_COLOR[cell.suit];
  const rd = rankDisplay(cell.rank);
  // Single-character ranks get a slightly bigger glyph than '10' so the
  // optical sizing reads consistent across the grid.
  const fontSize = rd.length === 1 ? 44 : 36;
  return `<div style="display:flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:6px;background:${COLOR.cardFace};box-shadow:0 1px 2px rgba(0,0,0,0.35);color:${sc};font-family:monospace;font-weight:800;font-size:${fontSize}px;line-height:1">${rd}</div>`;
};

const gridHtml = (grid: (CellCode | null)[]): string => {
  const rows: string[] = [];
  for (let r = 0; r < 5; r++) {
    const cells = grid
      .slice(r * 5, r * 5 + 5)
      .map(cellHtml)
      .join('');
    rows.push(`<div style="display:flex;gap:6px">${cells}</div>`);
  }
  return `
    <div style="display:flex;flex-direction:column;gap:6px;padding:18px;background:${COLOR.bgPanel};border-radius:12px;border:1px solid ${COLOR.outline};box-shadow:0 2px 8px rgba(0,0,0,0.4)">
      ${rows.join('')}
    </div>
  `;
};

const buildShareHtml = (
  score: number,
  mode: ModeLabel,
  difficulty: string | null,
  dateISO: string | null,
  grid: (CellCode | null)[]
): string => {
  const modeChip =
    mode === 'Daily' && dateISO
      ? `DAILY · ${formatShareDate(dateISO)}`
      : mode === 'Free' && difficulty
        ? difficulty.toUpperCase()
        : mode.toUpperCase();

  return `
    <div style="display:flex;width:1200px;height:630px;background:${COLOR.bgBase};padding:40px;align-items:center;gap:56px">
      ${gridHtml(grid)}
      <div style="display:flex;flex-direction:column;flex:1;align-items:flex-start;justify-content:center;gap:20px">
        <div style="display:flex;font-family:monospace;font-size:22px;font-weight:800;letter-spacing:6px;color:${COLOR.textMid};text-transform:uppercase">PokerGrid</div>
        <div style="display:flex;padding:6px 16px;border:1px solid ${COLOR.accent};border-radius:999px;color:${COLOR.accent};font-family:monospace;font-size:18px;font-weight:800;letter-spacing:3px">${modeChip}</div>
        <div style="display:flex;font-family:monospace;font-size:36px;font-weight:700;color:${COLOR.textMid};letter-spacing:2px;text-transform:uppercase">Final Score</div>
        <div style="display:flex;font-family:monospace;font-size:180px;font-weight:900;color:${COLOR.textHi};line-height:1;letter-spacing:4px">${score}</div>
        <div style="display:flex;font-family:monospace;font-size:16px;color:${COLOR.textLow};letter-spacing:2px;margin-top:12px">5×5 poker solitaire · pokergrid.app</div>
      </div>
    </div>
  `;
};

// ---- Handler -----------------------------------------------------------------

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const { score, mode, difficulty, dateISO, grid } = parseShare(url);

  const html = buildShareHtml(score, mode, difficulty, dateISO, grid);

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    // workers-og defaults the content-type to image/png. We add cache headers
    // so link-preview unfurl bursts don't re-render the same card.
    headers: {
      'cache-control': 'public, max-age=600, s-maxage=600',
    },
  });
};
