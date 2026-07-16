/* PokerGrid — deck skins (consolidated), drop-in replacement for deckSkins.ts.
 *
 * Token-driven CSS card faces — NO image assets. Colors come from themes.css
 * custom properties, so token-based skins recolor per theme (paper / paper-dark /
 * card-room / card-room-dark) and honor the four-color vs two-color deck setting.
 * A handful of motif skins (terrain, fluorescent, lava, carved) use fixed palettes
 * on purpose — see SKINS_FIXED_PALETTE below; the deck-color setting won't affect them.
 *
 * Usage:
 *   import { renderSkin, SKINS } from './deckSkins';
 *   const face = renderSkin('D27b', 'A', 'h', { four: true });            // desktop
 *   const faceM = renderSkin('D05a', 'K', 's', { mobile: true });          // mobile layout
 *   // face = { wrap: string, layers: Layer[] }  (inline-style strings)
 *
 * Render each layer as an absolutely-positioned <span> inside the wrap container.
 * The wrap sets `container-type: size` so the cq* units resolve; the app sizes the
 * square cell (width/height) and this fills it — the wrap does NOT cap size.
 *
 * `renderSkin` is pure and returns a valid face for all 13 ranks × 4 suits for every
 * id. Jokers are NOT a skin (the app draws its own joker face) — don't pass one.
 *
 * `mobile` folds into the same id: renderSkin(id, r, s, {mobile:true}) returns the
 * small-screen layout if the skin has one, else falls back to its normal layout.
 * No `-m` ids, no separate SKINS entries for mobile. SKINS_WITH_MOBILE lists which
 * ids actually differ on mobile.
 */

export type SuitKey = 'h' | 'd' | 'c' | 's';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Layer { style: string; glyph: string; kids: { style: string; glyph: string }[]; }
export interface CardFace { wrap: string; layers: Layer[]; }
export interface RenderOpts { four?: boolean; mobile?: boolean; }

const SUITS: Record<SuitKey, [string, string, string]> = {
  h: ['\u2665', 'var(--face-suit-h)', 'var(--card-red)'],
  d: ['\u2666', 'var(--face-suit-d)', 'var(--card-red)'],
  c: ['\u2663', 'var(--face-suit-c)', 'var(--card-black)'],
  s: ['\u2660', 'var(--face-suit-s)', 'var(--card-black)'],
};
const colorFor = (k: SuitKey, four: boolean) => (four ? SUITS[k][1] : SUITS[k][2]);

const L = (style: string, glyph = ''): Layer => ({ style, glyph, kids: [] });
const idx = (pos: [string, string], C: string, R: string, G: string, sz = 17): Layer => {
  const [v, h] = pos;
  return {
    style: `position:absolute;${v}:5cqh;${h}:6cqw;display:flex;flex-direction:column;align-items:center;line-height:.9;color:${C};${v === 'bottom' ? 'transform:rotate(180deg);' : ''}`,
    glyph: '',
    kids: [{ style: `font:700 ${sz}cqh var(--font-body)`, glyph: R }, { style: `font-size:${sz - 3}cqh`, glyph: G }],
  };
};
// Wrap: NO max-width — the app fills the square cell. Radius matches the
// app's card/cell token so skins sit in the grid like the default face.
// background-origin:border-box comes LAST (after `extra`'s background
// shorthand, which would reset it): gradient backgrounds are otherwise sized
// to the padding box and background-repeat wraps the tile under the 1px
// border — putting the gradient's opposite (often near-white) edge in the
// border strip, which reads as a hairline white seam when zoomed. (overflow:
// hidden also clips child layers at the padding box, so full-bleed layer art
// stops 1px short of the edge — skins whose foreground layers touch an edge
// must end the wrap background in that layer's color so the strip under the
// border matches.)
const BASE = (extra: string, C: string) =>
  `position:relative;width:100%;aspect-ratio:1/1;border-radius:var(--radius-sm,8px);overflow:hidden;background:var(--card-face);box-shadow:var(--card-shadow,var(--shadow-sm));container-type:size;color:${C};${extra || ''};background-origin:border-box`;
const rSans = 'position:absolute;top:7cqh;left:9cqw;font:700 40cqh var(--font-body);line-height:1;letter-spacing:-.03em';
const rSerif = 'position:absolute;top:6cqh;left:9cqw;font:680 42cqh var(--font-display);line-height:1;letter-spacing:-.01em';
const pipBR = 'position:absolute;bottom:6cqh;right:9cqw;font-size:32cqh;line-height:1';
const wm = (op: number) => `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:60cqh;line-height:1;opacity:${op};pointer-events:none`;

interface Ctx { C: string; G: string; R: string; k: SuitKey; }
type Builder = (ctx: Ctx) => { extra: string; layers: Layer[] };

// Court figure for the Old-timey deck: face cards show a chess glyph, pips show the rank.
const COURT_FIG: Record<string, string> = { K: '\u265A', Q: '\u265B', J: '\u265E' };
const oldTimey = (mobile: boolean): Builder => ({ C, G, R }) => {
  const fig = COURT_FIG[R];
  const frame = [
    L('position:absolute;inset:4cqmin;border:1.5cqmin double var(--warn);border-radius:3cqmin', ''),
    L('position:absolute;inset:8cqmin;border:.7cqmin solid var(--warn);border-radius:2cqmin;opacity:.6', ''),
  ];
  const center = fig
    ? L(`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${mobile ? 62 : 52}cqh;line-height:1;color:${C};transform:translateY(-5cqh)`, fig)
    : L(`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 ${mobile ? 58 : 52}cqh var(--font-display);line-height:1;color:${C};transform:translateY(-4cqh)`, R);
  if (mobile) {
    return { extra: 'border:1px solid var(--hairline);background:color-mix(in srgb,var(--warn) 7%,var(--card-face))', layers: [
      ...frame, center,
      L(`position:absolute;top:7cqh;left:9cqw;font:680 26cqh var(--font-display);line-height:.9;color:${C}`, R),
      L(`position:absolute;top:8cqh;right:9cqw;font-size:20cqh;color:${C}`, G),
    ] };
  }
  return { extra: 'border:1px solid var(--hairline);background:color-mix(in srgb,var(--warn) 7%,var(--card-face))', layers: [
    ...frame, center,
    L(`position:absolute;top:8cqh;left:10cqw;font:680 18cqh var(--font-display);line-height:.9;color:${C}`, R),
    L(`position:absolute;bottom:8cqh;right:10cqw;font:680 18cqh var(--font-display);line-height:.9;transform:rotate(180deg);color:${C}`, R),
    L(`position:absolute;top:9cqh;right:10cqw;font-size:15cqh;color:${C}`, G),
  ] };
};

// ── DESKTOP builders (34 skins) ──
const DESKTOP: Record<string, Builder> = {
  D05a: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [idx(['top', 'left'], C, R, G, 22), idx(['bottom', 'right'], C, R, G, 22)] }),
  D06c: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;top:5cqh;left:7cqw;font:680 20cqh var(--font-display);color:' + C, R), L('position:absolute;top:5cqh;right:7cqw;font:680 20cqh var(--font-display);color:' + C, R), L('position:absolute;bottom:5cqh;left:7cqw;font:680 20cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L('position:absolute;bottom:5cqh;right:7cqw;font:680 20cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L(wm(0.1), G)] }),
  D16: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80cqh;opacity:.9;line-height:1', G), L('position:absolute;top:7cqh;left:9cqw;font:700 20cqh var(--font-body);color:var(--card-face);mix-blend-mode:difference', R)] }),
  D21: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L(`position:absolute;inset:6cqmin;border-radius:5cqmin;border:1.5cqmin solid ${C};opacity:.4`, ''), L(rSans, R), L(pipBR, G)] }),
  D24: ({ G, R }) => ({ extra: '', layers: [L('position:absolute;top:0;left:0;right:0;border-top:2.5px dashed var(--ink-3)', ''), L('position:absolute;bottom:0;left:0;right:0;border-bottom:2.5px dashed var(--ink-3)', ''), L('position:absolute;top:0;left:0;height:42cqh;border-left:2.5px dashed var(--ink-3)', ''), L('position:absolute;bottom:0;left:0;height:42cqh;border-left:2.5px dashed var(--ink-3)', ''), L('position:absolute;top:0;right:0;height:42cqh;border-right:2.5px dashed var(--ink-3)', ''), L('position:absolute;bottom:0;right:0;height:42cqh;border-right:2.5px dashed var(--ink-3)', ''), L('position:absolute;top:50%;left:-5.5cqmin;width:11cqmin;height:11cqmin;border-radius:50%;background:var(--paper);transform:translateY(-50%)', ''), L('position:absolute;top:50%;right:-5.5cqmin;width:11cqmin;height:11cqmin;border-radius:50%;background:var(--paper);transform:translateY(-50%)', ''), L(rSans, R), L(pipBR, G)] }),
  D27b: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:linear-gradient(150deg,var(--card-face),color-mix(in srgb,${C} 18%,var(--card-face)))`, layers: [L(rSans, R), L(pipBR, G)] }),
  D27c: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:color-mix(in srgb,${C} 9%,var(--card-face))`, layers: [L('position:absolute;inset:5cqmin;border-radius:4cqmin;border:1cqmin solid var(--card-face)', ''), L(rSans, R), L(pipBR, G), L(wm(0.1), G)] }),
  W1: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:linear-gradient(145deg,var(--card-face) 8%,color-mix(in srgb,${C} 32%,var(--card-face)) 96%)`, layers: [L(rSans, R), L(pipBR, G)] }),
  W2: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:linear-gradient(160deg,var(--card-face),color-mix(in srgb,${C} 45%,var(--card-face)))`, layers: [L(rSans, R), L(pipBR, G)] }),
  W3: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:radial-gradient(circle at 78% 82%,color-mix(in srgb,${C} 42%,var(--card-face)),var(--card-face) 72%)`, layers: [L(rSans, R), L(pipBR, G)] }),
  D41c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:5cqmin;border:1cqmin double var(--warn);border-radius:3cqmin;opacity:.7', ''), L(rSerif, R), L(pipBR, G), L(wm(0.08), G)] }),
  D42: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;margin:auto;width:60cqmin;height:60cqmin;border-radius:50%;box-shadow:inset 0 2cqmin 3cqmin rgba(255,255,255,.5),inset 0 -2cqmin 3cqmin rgba(0,0,0,.12)', ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:44cqh', G), L('position:absolute;top:7cqh;left:9cqw;font:700 20cqh var(--font-body)', R)] }),
  D42a: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;margin:auto;width:64cqmin;height:64cqmin;border-radius:50%;box-shadow:inset 0 2cqmin 3cqmin rgba(255,255,255,.5),inset 0 -2cqmin 3cqmin rgba(0,0,0,.12)', ''), L(`position:absolute;inset:0;margin:auto;width:44cqmin;height:44cqmin;border-radius:50%;border:1cqmin solid ${C};opacity:.4`, ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:38cqh', G), L('position:absolute;top:7cqh;left:9cqw;font:700 18cqh var(--font-body)', R)] }),
  D51a: ({ G, R }) => ({ extra: 'border:2px solid var(--card-black);background:color-mix(in srgb,var(--warn) 12%,var(--card-face));clip-path:polygon(0 3%,8% 0,22% 4%,40% 0,60% 4%,80% 0,94% 4%,100% 2%,100% 98%,90% 100%,70% 97%,50% 100%,30% 97%,12% 100%,0 97%)', layers: [L('position:absolute;top:5cqh;left:0;right:0;text-align:center;font:700 8cqh var(--font-display);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)', 'Wanted'), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 44cqh var(--font-display);margin-top:6cqh', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:24cqh', G)] }),
  N1: ({ G, R }) => ({ extra: 'border:2px solid var(--card-black);background:color-mix(in srgb,var(--warn) 12%,var(--card-face));clip-path:polygon(0 3%,8% 0,22% 4%,40% 0,60% 4%,80% 0,94% 4%,100% 2%,100% 98%,90% 100%,70% 97%,50% 100%,30% 97%,12% 100%,0 97%)', layers: [L('position:absolute;inset:5cqmin;border:2cqmin dashed var(--card-black);border-radius:2cqmin;opacity:.55', ''), L('position:absolute;top:6cqh;left:0;right:0;text-align:center;font:700 8cqh var(--font-display);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)', 'Wanted'), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 42cqh var(--font-display);margin-top:5cqh', R), L('position:absolute;bottom:7cqh;right:11cqw;font-size:22cqh', G)] }),
  N2: ({ G, R }) => ({ extra: 'border:2px solid var(--card-black);background:color-mix(in srgb,var(--warn) 18%,var(--card-face));clip-path:polygon(0 3%,8% 0,22% 4%,40% 0,60% 4%,80% 0,94% 4%,100% 2%,100% 98%,90% 100%,70% 97%,50% 100%,30% 97%,12% 100%,0 97%)', layers: [L('position:absolute;inset:5cqmin;border:2cqmin dashed var(--warn);border-radius:2cqmin;opacity:.7', ''), L('position:absolute;top:6cqh;left:0;right:0;text-align:center;font:700 8cqh var(--font-display);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)', 'Wanted'), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 42cqh var(--font-display);margin-top:5cqh', R), L('position:absolute;bottom:7cqh;right:11cqw;font-size:22cqh', G)] }),
  D55b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:5cqmin;border-radius:4cqmin;border:2cqmin dashed var(--warn);opacity:.7', ''), L('position:absolute;top:3cqmin;left:3cqmin;width:5cqmin;height:5cqmin;border-radius:50%;background:var(--warn)', ''), L('position:absolute;bottom:3cqmin;right:3cqmin;width:5cqmin;height:5cqmin;border-radius:50%;background:var(--warn)', ''), L(rSerif, R), L(pipBR, G)] }),
  D62c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:color-mix(in srgb,#f3efe2 75%,var(--card-face))', layers: [L('position:absolute;inset:6cqmin;border:1.5cqmin solid #2f7d4f;border-radius:3cqmin;opacity:.6', ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 48cqh var(--font-display);color:#2f7d4f', R), L('position:absolute;top:8cqh;right:11cqw;font-size:18cqh;color:#b3262e', G)] }),
  C2: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:color-mix(in srgb,#efe7d2 80%,var(--card-face))', layers: [L('position:absolute;inset:5cqmin;border:1cqmin double #2f7d4f;border-radius:3cqmin;opacity:.6', ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 46cqh var(--font-display);color:#1e5a3a', R), L('position:absolute;bottom:7cqh;left:0;right:0;text-align:center;font-size:16cqh;color:#b3262e', G)] }),
  P1: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,color-mix(in srgb,#c9f7d4 55%,var(--card-face)),color-mix(in srgb,#e0c3fc 55%,var(--card-face)))', layers: [L(rSans + ';color:' + C, R), L(pipBR + ';color:' + C, G), L(wm(0.1), G)] }),
  P3: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,color-mix(in srgb,#ff9ec4 45%,var(--card-face)),color-mix(in srgb,#a5d8ff 45%,var(--card-face)))', layers: [L(rSans + ';color:' + C, R), L(pipBR + ';color:' + C, G), L(wm(0.1), G)] }),
  // Terrain · Set 1
  D64: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#f6e2b3,#e9c682 96%,#cfa055)', layers: [L('position:absolute;left:-10cqw;right:-10cqw;bottom:-14cqh;height:44cqh;border-radius:50%;background:#dcb066', ''), L('position:absolute;left:-10cqw;right:-30cqw;bottom:-6cqh;height:34cqh;border-radius:50%;background:#cfa055', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);color:#7a5321', R), L('position:absolute;top:8cqh;right:9cqw;font-size:26cqh;color:#7a5321', G)] }),
  D67b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#2d6a4f,#1b4332)', layers: [L('position:absolute;bottom:-4cqh;left:8cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:24cqh solid #40916c', ''), L('position:absolute;bottom:-4cqh;left:36cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:30cqh solid #52b788', ''), L('position:absolute;bottom:-4cqh;right:10cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:24cqh solid #40916c', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);color:#e9f5db', R), L('position:absolute;top:8cqh;right:9cqw;font-size:26cqh;color:#e9f5db', G)] }),
  D69b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,#e7f5ff,#74c0fc)', layers: [L('position:absolute;inset:0;background:conic-gradient(from 30deg at 60% 40%,rgba(255,255,255,.5),transparent 25%,rgba(255,255,255,.35) 55%,transparent 80%)', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);color:#1864ab', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:26cqh;color:#1864ab', G)] }),
  // Terrain · Set 2
  D65b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 40% 30%,#e08b6f,#c1573b 75%)', layers: [L('position:absolute;inset:0;background:linear-gradient(60deg,transparent 48%,rgba(0,0,0,.18) 49% 50%,transparent 51%),linear-gradient(-30deg,transparent 60%,rgba(0,0,0,.14) 61% 62%,transparent 63%)', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#fff', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:26cqh;line-height:1;color:#fff', G)] }),
  D70c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#cdeac0,#8fd694 96%,#3f8f57)', layers: [L('position:absolute;left:-14cqw;right:-14cqw;bottom:-8cqh;height:34cqh;border-radius:50%;background:#5aa469', ''), L('position:absolute;left:-6cqw;right:-30cqw;bottom:-14cqh;height:30cqh;border-radius:50%;background:#3f8f57', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);color:#1b4332', R), L('position:absolute;top:8cqh;right:9cqw;font-size:26cqh;color:#1b4332', G)] }),
  L1: ({ R, G }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 50% 120%,#ffba08,#e85d04 40%,#6a040f 85%)', layers: [L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#ffe8c2', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:26cqh;line-height:1;color:#ffe8c2', G)] }),
  D69c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(160deg,#caffbf,#9bf6ff 55%,#bdb2ff)', layers: [L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);color:#1d4e6b', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:26cqh;color:#1d4e6b', G)] }),
  // Fluorescent (fixed neon palettes; deck-color setting does not apply)
  EX6: ({ R, G }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,#d4ff00,#00ffa3 60%,#00e5ff)', layers: [L('position:absolute;top:7cqh;left:9cqw;font:700 38cqh var(--font-body);line-height:1;color:#141414', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:32cqh;color:#141414', G)] }),
  EX16: ({ R, G }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,#ff2079,#ff8a00 55%,#ffe500)', layers: [L('position:absolute;top:7cqh;left:9cqw;font:700 38cqh var(--font-body);line-height:1;color:#141414', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:32cqh;color:#141414', G)] }),
  EX17: ({ R, G }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,#00f5d4,#00bbf9 55%,#c1ff3d)', layers: [L('position:absolute;top:7cqh;left:9cqw;font:700 38cqh var(--font-body);line-height:1;color:#141414', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:32cqh;color:#141414', G)] }),
  // Old-timey court (one deck; court figures on J/Q/K, numerals otherwise)
  EX13: oldTimey(false),
};

// ── MOBILE builders (larger rank/suit; only ids that differ) ──
const MOBILE: Record<string, Builder> = {
  D05a: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [idx(['top', 'left'], C, R, G, 42), idx(['bottom', 'right'], C, R, G, 42)] }),
  D06c: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;top:4cqh;left:6cqw;font:680 30cqh var(--font-display);color:' + C, R), L('position:absolute;top:4cqh;right:6cqw;font:680 30cqh var(--font-display);color:' + C, R), L('position:absolute;bottom:4cqh;left:6cqw;font:680 30cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L('position:absolute;bottom:4cqh;right:6cqw;font:680 30cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L(wm(0.1), G)] }),
  D16: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80cqh;opacity:.9;line-height:1;transform:translate(6cqw,5cqh)', G), L('position:absolute;top:6cqh;left:8cqw;font:700 30cqh var(--font-body);color:var(--card-face);mix-blend-mode:difference', R)] }),
  D42: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;margin:auto;width:60cqmin;height:60cqmin;border-radius:50%;box-shadow:inset 0 2cqmin 3cqmin rgba(255,255,255,.5),inset 0 -2cqmin 3cqmin rgba(0,0,0,.12)', ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:44cqh', G), L('position:absolute;top:6cqh;left:8cqw;font:700 32cqh var(--font-body)', R)] }),
  D42a: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;margin:auto;width:64cqmin;height:64cqmin;border-radius:50%;box-shadow:inset 0 2cqmin 3cqmin rgba(255,255,255,.5),inset 0 -2cqmin 3cqmin rgba(0,0,0,.12)', ''), L(`position:absolute;inset:0;margin:auto;width:44cqmin;height:44cqmin;border-radius:50%;border:1cqmin solid ${C};opacity:.4`, ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:34cqh', G), L('position:absolute;top:6cqh;left:8cqw;font:700 30cqh var(--font-body)', R)] }),
  D62c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:color-mix(in srgb,#f3efe2 75%,var(--card-face))', layers: [L('position:absolute;inset:6cqmin;border:1.5cqmin solid #2f7d4f;border-radius:3cqmin;opacity:.6', ''), L('position:absolute;top:8cqh;right:11cqw;font-size:27cqh;color:#b3262e', G), L('position:absolute;bottom:5cqh;left:9cqw;font:680 60cqh var(--font-display);line-height:1;color:#2f7d4f', R)] }),
  C2: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:color-mix(in srgb,#efe7d2 80%,var(--card-face))', layers: [L('position:absolute;inset:5cqmin;border:1cqmin double #2f7d4f;border-radius:3cqmin;opacity:.6', ''), L('position:absolute;top:15cqh;left:0;right:0;text-align:center;font:680 46cqh var(--font-display);line-height:1;color:#1e5a3a', R), L('position:absolute;bottom:13cqh;left:0;right:0;text-align:center;font-size:28cqh;line-height:1;color:#b3262e', G)] }),
  D64: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#f6e2b3,#e9c682 96%,#cfa055)', layers: [L('position:absolute;left:-10cqw;right:-10cqw;bottom:-14cqh;height:44cqh;border-radius:50%;background:#dcb066', ''), L('position:absolute;left:-10cqw;right:-30cqw;bottom:-6cqh;height:34cqh;border-radius:50%;background:#cfa055', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 40cqh var(--font-body);color:#7a5321', R), L('position:absolute;top:7cqh;right:8cqw;font-size:34cqh;color:#7a5321', G)] }),
  D65b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 40% 30%,#e08b6f,#c1573b 75%)', layers: [L('position:absolute;inset:0;background:linear-gradient(60deg,transparent 48%,rgba(0,0,0,.18) 49% 50%,transparent 51%),linear-gradient(-30deg,transparent 60%,rgba(0,0,0,.14) 61% 62%,transparent 63%)', ''), L('position:absolute;top:6cqh;left:8cqw;font:700 40cqh var(--font-body);color:#fff', R), L('position:absolute;top:7cqh;right:8cqw;font-size:34cqh;color:#fff', G)] }),
  D67b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#2d6a4f,#1b4332)', layers: [L('position:absolute;bottom:-4cqh;left:8cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:24cqh solid #40916c', ''), L('position:absolute;bottom:-4cqh;left:36cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:30cqh solid #52b788', ''), L('position:absolute;bottom:-4cqh;right:10cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:24cqh solid #40916c', ''), L('position:absolute;top:6cqh;left:8cqw;font:700 40cqh var(--font-body);color:#e9f5db', R), L('position:absolute;top:7cqh;right:8cqw;font-size:34cqh;color:#e9f5db', G)] }),
  D69b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,#e7f5ff,#74c0fc)', layers: [L('position:absolute;inset:0;background:conic-gradient(from 30deg at 60% 40%,rgba(255,255,255,.5),transparent 25%,rgba(255,255,255,.35) 55%,transparent 80%)', ''), L('position:absolute;top:6cqh;left:8cqw;font:700 40cqh var(--font-body);color:#1864ab', R), L('position:absolute;bottom:5cqh;right:8cqw;font-size:34cqh;color:#1864ab', G)] }),
  D70c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#cdeac0,#8fd694 96%,#3f8f57)', layers: [L('position:absolute;left:-14cqw;right:-14cqw;bottom:-8cqh;height:34cqh;border-radius:50%;background:#5aa469', ''), L('position:absolute;left:-6cqw;right:-30cqw;bottom:-14cqh;height:30cqh;border-radius:50%;background:#3f8f57', ''), L('position:absolute;top:6cqh;left:8cqw;font:700 40cqh var(--font-body);color:#1b4332', R), L('position:absolute;top:7cqh;right:8cqw;font-size:34cqh;color:#1b4332', G)] }),
  L1: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 50% 120%,#ffba08,#e85d04 40%,#6a040f 85%)', layers: [L('position:absolute;top:6cqh;left:8cqw;font:700 40cqh var(--font-body);color:#ffe8c2', R), L('position:absolute;bottom:5cqh;right:8cqw;font-size:34cqh;color:#ffe8c2', G)] }),
  D69c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(160deg,#caffbf,#9bf6ff 55%,#bdb2ff)', layers: [L('position:absolute;top:6cqh;left:8cqw;font:700 40cqh var(--font-body);color:#1d4e6b', R), L('position:absolute;bottom:5cqh;right:8cqw;font-size:34cqh;color:#1d4e6b', G)] }),
  EX13: oldTimey(true),
};

export interface SkinMeta { id: string; name: string; family: string; }
export const SKINS: SkinMeta[] = [
  { id: 'D05a', name: 'Bold twin index', family: 'Twin corners' },
  { id: 'D06c', name: 'Quad serif', family: 'Quad corners' },
  { id: 'D16', name: 'Jumbo pip + mini rank', family: 'Inset panel' },
  { id: 'D21', name: 'Rounded inner keyline', family: 'Keyline' },
  { id: 'D24', name: 'Ticket notch', family: 'Ticket' },
  { id: 'D27b', name: 'Gradient wash', family: 'Suit-color / gradient wash' },
  { id: 'D27c', name: 'Wash + keyline', family: 'Suit-color / gradient wash' },
  { id: 'W1', name: 'Gradient wash · corner fade', family: 'Suit-color / gradient wash' },
  { id: 'W2', name: 'Gradient wash · deep sweep', family: 'Suit-color / gradient wash' },
  { id: 'W3', name: 'Gradient wash · radial glow', family: 'Suit-color / gradient wash' },
  { id: 'D41c', name: 'Gilt filigree', family: 'Filigree keyline' },
  { id: 'D42', name: 'Emboss ring', family: 'Emboss ring' },
  { id: 'D42a', name: 'Double ring', family: 'Emboss ring' },
  { id: 'D51a', name: 'Torn notice', family: 'Wanted poster' },
  { id: 'N1', name: 'Torn notice · rope', family: 'Wanted poster' },
  { id: 'N2', name: 'Torn notice · warm rope', family: 'Wanted poster' },
  { id: 'D55b', name: 'Rope + knots', family: 'Rope frame' },
  { id: 'D62c', name: 'Carved rank', family: 'Carved' },
  { id: 'C2', name: 'Carved · ivory double-rule', family: 'Carved' },
  { id: 'P1', name: 'Pastel · mint · lilac', family: 'Pastel wash' },
  { id: 'P3', name: 'Pastel · rose · blue', family: 'Pastel wash' },
  { id: 'D64', name: 'Sand dunes', family: 'Terrain · Set 1' },
  { id: 'D67b', name: 'Pine rows', family: 'Terrain · Set 1' },
  { id: 'D69b', name: 'Glacier facets', family: 'Terrain · Set 1' },
  { id: 'D65b', name: 'Cracked clay', family: 'Terrain · Set 2' },
  { id: 'D70c', name: 'Rolling hills', family: 'Terrain · Set 2' },
  { id: 'L1', name: 'Lava · clean ember', family: 'Terrain · Set 2' },
  { id: 'D69c', name: 'Aurora ice', family: 'Aurora ice' },
  { id: 'EX6', name: 'Fluoro wash', family: 'Fluorescent' },
  { id: 'EX16', name: 'Fluoro sunset', family: 'Fluorescent' },
  { id: 'EX17', name: 'Fluoro aqua', family: 'Fluorescent' },
  { id: 'EX13', name: 'Old-timey court', family: 'Old-timey' },
];

export const SKIN_IDS: string[] = SKINS.map((s) => s.id);

/** Ids that render a distinct layout on mobile (all others fall back to desktop). */
export const SKINS_WITH_MOBILE: string[] = Object.keys(MOBILE);

/** Ids whose palette is fixed (not theme-token / suit-color driven). Informational. */
export const SKINS_FIXED_PALETTE: string[] = ['D62c', 'C2', 'D64', 'D67b', 'D69b', 'D65b', 'D70c', 'L1', 'D69c', 'EX6', 'EX16', 'EX17'];

/** Build a card face for a given skin id, rank and suit. Pure. */
export function renderSkin(id: string, rank: Rank | string, suit: SuitKey, opts: RenderOpts = {}): CardFace {
  const build = (opts.mobile && MOBILE[id]) || DESKTOP[id];
  if (!build) throw new Error(`Unknown skin id: ${id}`);
  const four = opts.four !== false;
  const C = colorFor(suit, four);
  const G = SUITS[suit][0];
  const { extra, layers } = build({ C, G, R: String(rank), k: suit });
  return { wrap: BASE(extra, C), layers };
}

/* Optional React helper:
 *
 * import React from 'react';
 * const styleObj = (s: string): React.CSSProperties => Object.fromEntries(
 *   s.split(';').filter(Boolean).map((d) => {
 *     const i = d.indexOf(':'); const prop = d.slice(0, i).trim(); const val = d.slice(i + 1).trim();
 *     return [prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), val];
 *   })
 * ) as React.CSSProperties;
 *
 * export function CardFaceView({ id, rank, suit, four = true, mobile = false, size = 82 }:
 *   { id: string; rank: string; suit: SuitKey; four?: boolean; mobile?: boolean; size?: number }) {
 *   const { wrap, layers } = renderSkin(id, rank, suit, { four, mobile });
 *   return (
 *     <div style={{ ...styleObj(wrap), width: size, height: size }}>
 *       {layers.map((l, i) => (
 *         <span key={i} style={styleObj(l.style)}>
 *           {l.glyph}
 *           {l.kids.map((k, j) => <span key={j} style={styleObj(k.style)}>{k.glyph}</span>)}
 *         </span>
 *       ))}
 *     </div>
 *   );
 * }
 */
