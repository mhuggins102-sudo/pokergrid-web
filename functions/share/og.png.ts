// GET /share/og.png?score=...&mode=...&diff=...&tier=...&variant=...&theme=...
//
// Generates the 1200×630 share card image referenced by the /share page's
// og:image meta tag. Link-preview clients (iMessage, Slack, Discord, Twitter)
// fetch this directly when they unfurl a shared PokerGrid URL.
//
// The card carries the RESULT, not the board: date (dailies), difficulty,
// variant, the score, and the rating tier — rendered in the sharer's own
// theme palette (the `theme` param carries their resolved data-theme).
//
// Rendered with workers-og — Satori under the hood, no headless browser. The
// engine accepts an HTML string (not JSX), so we build the markup as a
// template literal with inline styles. Layout must obey Satori's flex-only
// constraint: every element that contains more than one child needs an
// explicit `display: flex` (and almost everything does, even leaf <div>s
// containing text, to satisfy the renderer).

import { ImageResponse } from 'workers-og';
import {
  ParsedShare,
  TIER_LABEL,
  ThemeKey,
  escapeHtml,
  formatShareDate,
  parseShare,
} from './_shared';

// ---- Theme palettes ---------------------------------------------------------

// Mirrors the four data-theme blocks in src/design/tokens.css. The
// `panel` values are the precomputed color-mix results (Satori can't
// evaluate color-mix()).
type Palette = {
  bg: string;
  panel: string;
  outline: string;
  textHi: string;
  textMid: string;
  accent: string;
  onAccent: string;
};

const PALETTES: Record<ThemeKey, Palette> = {
  paper: {
    bg: '#f4f1e8',
    panel: '#faf9f5',
    outline: 'rgba(26, 26, 22, 0.18)',
    textHi: '#1a1a16',
    textMid: '#66645a',
    accent: '#7a1f2b',
    onAccent: '#ffffff',
  },
  'paper-dark': {
    bg: '#14120d',
    panel: '#22201c',
    outline: 'rgba(239, 231, 212, 0.16)',
    textHi: '#efe7d4',
    textMid: '#9a917c',
    accent: '#c0392b',
    onAccent: '#ffffff',
  },
  'card-room': {
    bg: '#f4f1e9',
    panel: '#faf9f6',
    outline: 'rgba(42, 28, 30, 0.14)',
    textHi: '#2a1c1e',
    textMid: '#6e5a5c',
    accent: '#7a2233',
    onAccent: '#ffffff',
  },
  'card-room-dark': {
    bg: '#0e1712',
    panel: '#1d2520',
    outline: 'rgba(232, 239, 230, 0.13)',
    textHi: '#e8efe6',
    textMid: '#8ea095',
    accent: '#33a06a',
    onAccent: '#ffffff',
  },
};

// ---- HTML builder -----------------------------------------------------------

// Exported for preview/test harnesses; the handler below is the
// production consumer.
export const buildShareHtml = (share: ParsedShare): string => {
  const C = PALETTES[share.theme];

  // Top chip: the mode, with the puzzle date for dailies.
  const modeChip =
    share.mode === 'Daily' && share.dateISO
      ? `DAILY · ${formatShareDate(share.dateISO)}`
      : share.mode === 'Free'
        ? 'FREE PLAY'
        : share.mode.toUpperCase();

  // Meta line under the score: difficulty · variant.
  const meta = [share.difficulty, share.variant]
    .filter(Boolean)
    .map(s => escapeHtml(String(s).toUpperCase()))
    .join(' · ');

  const tierRow = share.tier
    ? `
      <div style="display:flex;align-items:center;gap:18px;margin-top:4px">
        <div style="display:flex;align-items:center;justify-content:center;min-width:72px;height:72px;padding:0 14px;border-radius:16px;background:${C.accent};color:${C.onAccent};font-family:monospace;font-size:44px;font-weight:900;letter-spacing:2px">${share.tier}</div>
        <div style="display:flex;font-family:monospace;font-size:34px;font-weight:700;color:${C.textHi};letter-spacing:2px">${TIER_LABEL[share.tier]}</div>
      </div>`
    : '';

  return `
    <div style="display:flex;width:1200px;height:630px;background:${C.bg};align-items:center;justify-content:center">
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;background:${C.panel};border:1px solid ${C.outline};border-radius:24px;padding:44px 96px;box-shadow:0 2px 12px rgba(0,0,0,0.25)">
        <div style="display:flex;font-family:monospace;font-size:26px;font-weight:800;letter-spacing:8px;color:${C.textMid};text-transform:uppercase">PokerGrid</div>
        <div style="display:flex;padding:6px 18px;border:1px solid ${C.accent};border-radius:999px;color:${C.accent};font-family:monospace;font-size:20px;font-weight:800;letter-spacing:3px">${escapeHtml(modeChip)}</div>
        <div style="display:flex;font-family:monospace;font-size:150px;font-weight:900;color:${C.textHi};line-height:1;letter-spacing:4px">${share.score}</div>
        ${
          meta
            ? `<div style="display:flex;font-family:monospace;font-size:24px;font-weight:700;color:${C.textMid};letter-spacing:3px">${meta}</div>`
            : ''
        }
        ${tierRow}
        <div style="display:flex;font-family:monospace;font-size:16px;color:${C.textMid};letter-spacing:2px;margin-top:10px">5×5 poker solitaire · pokergrid.app</div>
      </div>
    </div>
  `;
};

// ---- Handler -----------------------------------------------------------------

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const share = parseShare(url);

  const html = buildShareHtml(share);

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
