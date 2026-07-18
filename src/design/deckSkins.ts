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

// Fixed red-suit/black-suit ink splits for the Art family (their bases
// are fixed palettes, so the theme suit tokens don't apply).
const ART_SUIT: Record<SuitKey, string> = { h: '#a4243b', d: '#a4243b', c: '#26231d', s: '#26231d' };
const IMPRESSION_SUIT: Record<SuitKey, string> = { h: '#96606e', d: '#96606e', c: '#5d4c63', s: '#5d4c63' };
// Cream halo lifts the soft rank off the full-bleed pastel field.
const IMPRESSION_HALO = 'rgba(240,226,214,.9)';
const POP_SUIT: Record<SuitKey, string> = { h: '#d23a2e', d: '#d23a2e', c: '#1f4bb8', s: '#1f4bb8' };

// Ticket (D24) die-cut silhouette: 8 sawtooth teeth per segment (4% deep,
// 2.625% half-pitch) down each side above and below a 7%-deep punched
// half-circle notch at mid-height; straight top/bottom edges.
const TICKET_CLIP = 'polygon(0% 0%,100% 0%,96% 2.63%,100% 5.25%,96% 7.88%,100% 10.5%,96% 13.13%,100% 15.75%,96% 18.38%,100% 21%,96% 23.63%,100% 26.25%,96% 28.88%,100% 31.5%,96% 34.13%,100% 36.75%,96% 39.38%,100% 42%,96.5% 43.5%,94% 46%,93% 50%,94% 54%,96.5% 56.5%,100% 58%,96% 60.63%,100% 63.25%,96% 65.88%,100% 68.5%,96% 71.13%,100% 73.75%,96% 76.38%,100% 79%,96% 81.63%,100% 84.25%,96% 86.88%,100% 89.5%,96% 92.13%,100% 94.75%,96% 97.38%,100% 100%,0% 100%,4% 97.38%,0% 94.75%,4% 92.13%,0% 89.5%,4% 86.88%,0% 84.25%,4% 81.63%,0% 79%,4% 76.38%,0% 73.75%,4% 71.13%,0% 68.5%,4% 65.88%,0% 63.25%,4% 60.63%,0% 58%,3.5% 56.5%,6% 54%,7% 50%,6% 46%,3.5% 43.5%,0% 42%,4% 39.38%,0% 36.75%,4% 34.13%,0% 31.5%,4% 28.88%,0% 26.25%,4% 23.63%,0% 21%,4% 18.38%,0% 15.75%,4% 13.13%,0% 10.5%,4% 7.88%,0% 5.25%,4% 2.63%)';

// ── DESKTOP builders (44 skins) ──
const DESKTOP: Record<string, Builder> = {
  D05a: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [idx(['top', 'left'], C, R, G, 22), idx(['bottom', 'right'], C, R, G, 22)] }),
  D06c: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;top:5cqh;left:7cqw;font:680 20cqh var(--font-display);color:' + C, R), L('position:absolute;top:5cqh;right:7cqw;font:680 20cqh var(--font-display);color:' + C, R), L('position:absolute;bottom:5cqh;left:7cqw;font:680 20cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L('position:absolute;bottom:5cqh;right:7cqw;font:680 20cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L(wm(0.1), G)] }),
  D16: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80cqh;opacity:.9;line-height:1', G), L('position:absolute;top:7cqh;left:9cqw;font:700 20cqh var(--font-body);color:var(--card-face);mix-blend-mode:difference', R)] }),
  D21: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L(`position:absolute;inset:6cqmin;border-radius:5cqmin;border:1.5cqmin solid ${C};opacity:.4`, ''), L(rSans, R), L(pipBR, G)] }),
  // Ticket: a genuinely die-cut ticket — fine sawtooth teeth run down the
  // LEFT and RIGHT edges (the same edges that carry the punched half-circle
  // notches; top and bottom are straight cuts). The wrap paints an ink-toned
  // back clipped to the silhouette, and the first layer re-cuts the SAME
  // %-polygon on a box inset by 2cqmin filled with the card face — a
  // congruent shrunken silhouette leaving a thin rim that traces every
  // tooth and notch (clip-path clips real borders, so a border property
  // can't follow the cut).
  D24: ({ G, R }) => ({ extra: `background:color-mix(in srgb,var(--ink) 58%,var(--card-face));clip-path:${TICKET_CLIP}`, layers: [L(`position:absolute;inset:2cqmin;background:var(--card-face);clip-path:${TICKET_CLIP};border-radius:max(0px,calc(var(--radius-sm,8px) - 2cqmin))`), L(rSans, R), L(pipBR, G)] }),
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
  // ── Prism (token-driven: near-white base keeps the theme suit inks) ──
  PZ1: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,#ffffff,#f4f2f8 45%,#ebe9f2)', layers: [L('position:absolute;inset:0;background:conic-gradient(from 218deg at 72% 28%,rgba(255,0,90,.14),rgba(255,154,0,.13) 55deg,rgba(208,222,33,.11) 115deg,rgba(79,220,74,.12) 165deg,rgba(63,218,216,.15) 215deg,rgba(28,127,238,.15) 275deg,rgba(149,0,255,.13) 330deg,rgba(255,0,90,.14))'), L('position:absolute;inset:0;background:linear-gradient(115deg,transparent 32%,rgba(255,255,255,.9) 46%,transparent 58%)'), L(rSans, R), L(pipBR, G)] }),
  PZ2: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(150deg,#ffffff,#f1eff6)', layers: [L('position:absolute;inset:0;background:linear-gradient(160deg,rgba(63,218,216,.42),rgba(63,218,216,0) 60%);clip-path:polygon(100% 0,100% 78%,34% 0)'), L('position:absolute;inset:0;background:linear-gradient(200deg,rgba(149,0,255,.30),rgba(149,0,255,0) 70%);clip-path:polygon(100% 22%,100% 100%,30% 100%)'), L('position:absolute;inset:0;background:linear-gradient(35deg,rgba(255,0,90,.32),rgba(255,0,90,0) 65%);clip-path:polygon(0 45%,0 100%,72% 100%)'), L('position:absolute;inset:0;background:linear-gradient(140deg,rgba(255,196,0,.25),rgba(255,196,0,0) 55%);clip-path:polygon(0 0,58% 0,0 62%)'), L('position:absolute;inset:0;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.95) 47%,transparent 55%)'), L(rSans, R), L(pipBR, G)] }),
  // ── Music (fixed palettes) ──
  MU1: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 18% 18%,#ff2079 0 24%,transparent 48%),radial-gradient(circle at 86% 28%,#ffd400 0 26%,transparent 52%),radial-gradient(circle at 22% 86%,#00bfa5 0 26%,transparent 52%),radial-gradient(circle at 82% 82%,#7b2ff7 0 24%,transparent 48%),linear-gradient(#ff6d00,#ff6d00)', layers: [L('position:absolute;top:7cqh;left:9cqw;font:800 34cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#fff8e7;text-shadow:0 .5cqmin 2.5cqmin rgba(36,23,52,.85)', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:27cqh;line-height:1;color:#fff8e7;text-shadow:0 .5cqmin 2.5cqmin rgba(36,23,52,.85)', G)] }),
  MU2: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#180f33 0%,#2b1257 48%,#611383 78%,#180f33 100%)', layers: [L('position:absolute;left:0;right:0;top:24cqh;margin:auto;width:52cqmin;height:52cqmin;border-radius:50%;background:repeating-linear-gradient(180deg,transparent 0 7cqmin,#180f33 7cqmin 9cqmin),linear-gradient(#ffd319,#ff2975 80%)'), L('position:absolute;left:0;right:0;bottom:0;height:26cqh;background:repeating-linear-gradient(90deg,rgba(255,105,180,.75) 0 .9cqmin,transparent .9cqmin 11cqmin),repeating-linear-gradient(180deg,rgba(255,105,180,.65) 0 .9cqmin,transparent .9cqmin 6.5cqmin),linear-gradient(rgba(24,15,51,.2),#180f33)'), L('position:absolute;top:6cqh;left:8cqw;font:800 32cqh var(--font-body);line-height:1;color:#ffe9f2;text-shadow:0 0 3cqmin #ff2975', R), L('position:absolute;top:7cqh;right:8cqw;font-size:24cqh;line-height:1;color:#ffe9f2;text-shadow:0 0 3cqmin #ff2975', G)] }),
  MU3: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:#101018', layers: [L('position:absolute;left:8cqw;right:8cqw;top:34cqh;bottom:8cqh;background:linear-gradient(180deg,#ff2975 0 22%,#ffd319 22% 46%,#2ee6a8 46% 100%);clip-path:polygon(0 45%,15% 45%,15% 20%,32% 20%,32% 62%,49% 62%,49% 0,66% 0,66% 34%,83% 34%,83% 56%,100% 56%,100% 100%,0 100%)'), L('position:absolute;left:8cqw;right:8cqw;top:34cqh;bottom:8cqh;background:repeating-linear-gradient(90deg,transparent 0 12%,#101018 12% 17%)'), L('position:absolute;top:7cqh;left:9cqw;font:800 32cqh var(--font-body);line-height:1;color:#f4f1ff;text-shadow:0 0 3cqmin rgba(46,230,168,.6)', R), L('position:absolute;top:8cqh;right:9cqw;font-size:24cqh;line-height:1;color:#f4f1ff;text-shadow:0 0 3cqmin rgba(255,41,117,.7)', G)] }),
  MU4: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(200deg,#2c1444,#170b26 70%)', layers: [L('position:absolute;right:6cqw;top:-14cqh;width:44cqmin;height:44cqmin;border-radius:50%;background:repeating-linear-gradient(0deg,rgba(23,11,38,.35) 0 .9cqmin,transparent .9cqmin 6.4cqmin),repeating-linear-gradient(90deg,rgba(23,11,38,.35) 0 .9cqmin,transparent .9cqmin 6.4cqmin),radial-gradient(circle at 35% 30%,#ffffff,#cdd1dd 45%,#8d93a5 80%)'), L('position:absolute;right:2cqw;top:16cqh;width:60cqw;height:80cqh;background:linear-gradient(200deg,rgba(255,182,229,.30),rgba(255,182,229,0) 65%);clip-path:polygon(78% 0,100% 0,58% 100%,18% 100%)'), L('position:absolute;left:10cqw;top:10cqh;width:70cqw;height:86cqh;background:linear-gradient(160deg,rgba(148,214,255,.24),rgba(148,214,255,0) 60%);clip-path:polygon(72% 0,95% 0,42% 100%,4% 100%)'), L('position:absolute;inset:0;background:radial-gradient(circle at 16% 30%,rgba(255,255,255,.9) .5cqmin,transparent 1.2cqmin),radial-gradient(circle at 34% 16%,rgba(255,255,255,.7) .45cqmin,transparent 1.1cqmin),radial-gradient(circle at 55% 38%,rgba(255,255,255,.8) .5cqmin,transparent 1.2cqmin),radial-gradient(circle at 24% 60%,rgba(255,255,255,.6) .45cqmin,transparent 1.1cqmin)'), L('position:absolute;bottom:6cqh;left:9cqw;font:800 32cqh var(--font-body);line-height:1;color:#fdeffa;text-shadow:0 0 3.5cqmin rgba(255,120,210,.75)', R), L('position:absolute;bottom:7cqh;right:9cqw;font-size:24cqh;line-height:1;color:#fdeffa;text-shadow:0 0 3.5cqmin rgba(148,214,255,.75)', G)] }),
  // ── Space (fixed palette; pairs with Aurora ice) ──
  SP1: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 28% 22%,#334070 0,#1c2344 42%,#0d1026 100%)', layers: [L('position:absolute;inset:0;background:radial-gradient(circle at 18% 38%,rgba(255,255,255,.95) .6cqmin,transparent 1.4cqmin),radial-gradient(circle at 44% 14%,rgba(255,255,255,.8) .5cqmin,transparent 1.2cqmin),radial-gradient(circle at 66% 44%,rgba(255,255,255,.9) .7cqmin,transparent 1.6cqmin),radial-gradient(circle at 30% 68%,rgba(255,255,255,.7) .5cqmin,transparent 1.2cqmin),radial-gradient(circle at 56% 84%,rgba(255,255,255,.85) .6cqmin,transparent 1.4cqmin),radial-gradient(circle at 86% 16%,rgba(255,255,255,.75) .5cqmin,transparent 1.2cqmin),radial-gradient(circle at 12% 88%,rgba(255,255,255,.8) .5cqmin,transparent 1.2cqmin)'), L('position:absolute;right:8cqw;bottom:10cqh;width:20cqmin;height:20cqmin;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe3ad,#f2a65a 70%,#c97b3d)'), L('position:absolute;right:2.5cqw;bottom:15cqh;width:31cqmin;height:10cqmin;border:1.2cqmin solid rgba(255,227,173,.75);border-radius:50%;transform:rotate(-22deg)'), L('position:absolute;top:7cqh;left:9cqw;font:700 34cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#e9edff', R), L('position:absolute;bottom:6cqh;left:9cqw;font-size:26cqh;line-height:1;color:#ffd479', G)] }),
  // ── Art (fixed palettes) ──
  AR1: ({ G, R, k }) => ({ extra: 'border:1px solid var(--hairline);background:#f5efdd', layers: [L('position:absolute;inset:0;background:repeating-conic-gradient(from -34deg at 50% 122%,rgba(176,138,30,.5) 0 2.6deg,transparent 2.6deg 10.4deg)'), L('position:absolute;inset:0;background:linear-gradient(rgba(245,239,221,.95) 26%,rgba(245,239,221,0) 68%)'), L('position:absolute;inset:4cqmin;border:1cqmin solid #b08a1e;border-radius:2.5cqmin'), L('position:absolute;inset:7cqmin;border:.4cqmin solid rgba(176,138,30,.55);border-radius:1.8cqmin'), L(`position:absolute;top:8cqh;left:11cqw;font:680 36cqh var(--font-display);line-height:1;color:${ART_SUIT[k]}`, R), L(`position:absolute;bottom:8cqh;right:11cqw;font-size:26cqh;line-height:1;color:${ART_SUIT[k]}`, G)] }),
  AR2: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:#f8f7f2', layers: [L('position:absolute;left:64%;top:0;right:0;height:58%;background:#c1272d'), L('position:absolute;left:0;bottom:0;width:26%;height:24%;background:#1f4bb8'), L('position:absolute;right:0;bottom:0;width:16%;height:15%;background:#e8b90f'), L('position:absolute;left:64%;top:0;bottom:0;width:2cqmin;background:#1c1a17'), L('position:absolute;left:0;right:0;top:58%;height:2cqmin;background:#1c1a17'), L('position:absolute;left:26%;top:58%;bottom:0;width:2cqmin;background:#1c1a17'), L('position:absolute;right:16%;top:58%;bottom:0;width:2cqmin;background:#1c1a17'), L('position:absolute;left:0;right:0;bottom:15%;height:2cqmin;background:#1c1a17;clip-path:inset(0 0 0 84%)'), L('position:absolute;top:7cqh;left:9cqw;font:700 34cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#1c1a17', R), L('position:absolute;top:8cqh;right:7cqw;font-size:22cqh;line-height:1;color:#f8f7f2', G)] }),
  AR3: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:#efe9dc', layers: [L('position:absolute;right:-12cqw;top:-12cqh;width:48cqmin;height:48cqmin;border-radius:50%;background:#d23a2e'), L('position:absolute;left:-6cqw;bottom:-6cqh;width:60cqmin;height:60cqmin;background:#e8b90f;clip-path:polygon(0 100%,0 26%,78% 100%)'), L('position:absolute;left:-26cqw;top:22cqh;width:52cqmin;height:52cqmin;border:4.5cqmin solid #1f4bb8;border-radius:50%'), L('position:absolute;left:6cqw;top:58cqh;width:96cqw;height:1.5cqmin;background:#1c1a17;transform:rotate(-24deg)'), L('position:absolute;bottom:5cqh;right:8cqw;font:700 34cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#1c1a17', R), L('position:absolute;top:8cqh;right:7cqw;font-size:22cqh;line-height:1;color:#fdf6ec', G)] }),
  AR4: ({ G, R, k }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 25% 30%,rgba(232,168,184,.4) 0 30%,transparent 48%),radial-gradient(circle at 75% 25%,rgba(168,196,224,.4) 0 30%,transparent 48%),radial-gradient(circle at 30% 75%,rgba(179,203,166,.4) 0 30%,transparent 48%),radial-gradient(circle at 80% 78%,rgba(195,174,214,.4) 0 30%,transparent 48%),linear-gradient(140deg,#f0e2d6,#e9e2d0)', layers: [L('position:absolute;inset:0;background:radial-gradient(circle at 10% 10%,rgba(232,168,184,.55) 0 15%,transparent 23%),radial-gradient(circle at 36% 8%,rgba(236,217,160,.5) 0 14%,transparent 22%),radial-gradient(circle at 64% 12%,rgba(168,196,224,.55) 0 15%,transparent 23%),radial-gradient(circle at 90% 8%,rgba(231,154,142,.5) 0 14%,transparent 22%),radial-gradient(circle at 6% 36%,rgba(179,203,166,.55) 0 15%,transparent 23%),radial-gradient(circle at 32% 32%,rgba(195,174,214,.5) 0 15%,transparent 23%),radial-gradient(circle at 58% 34%,rgba(232,168,184,.5) 0 14%,transparent 22%),radial-gradient(circle at 86% 32%,rgba(179,203,166,.5) 0 15%,transparent 23%),radial-gradient(circle at 12% 60%,rgba(242,196,160,.55) 0 15%,transparent 23%),radial-gradient(circle at 40% 58%,rgba(168,196,224,.5) 0 15%,transparent 23%),radial-gradient(circle at 66% 60%,rgba(195,174,214,.55) 0 15%,transparent 23%),radial-gradient(circle at 92% 58%,rgba(232,168,184,.5) 0 14%,transparent 22%),radial-gradient(circle at 8% 86%,rgba(168,196,224,.5) 0 15%,transparent 23%),radial-gradient(circle at 34% 88%,rgba(231,154,142,.5) 0 14%,transparent 22%),radial-gradient(circle at 62% 86%,rgba(236,217,160,.55) 0 15%,transparent 23%),radial-gradient(circle at 88% 88%,rgba(179,203,166,.5) 0 15%,transparent 23%)'), L('position:absolute;inset:0;background:radial-gradient(circle at 22% 22%,rgba(231,154,142,.35) 0 9%,transparent 15%),radial-gradient(circle at 50% 18%,rgba(179,203,166,.35) 0 9%,transparent 15%),radial-gradient(circle at 78% 22%,rgba(195,174,214,.35) 0 9%,transparent 15%),radial-gradient(circle at 20% 46%,rgba(168,196,224,.35) 0 9%,transparent 15%),radial-gradient(circle at 48% 44%,rgba(236,217,160,.35) 0 9%,transparent 15%),radial-gradient(circle at 76% 46%,rgba(232,168,184,.35) 0 9%,transparent 15%),radial-gradient(circle at 24% 72%,rgba(195,174,214,.35) 0 9%,transparent 15%),radial-gradient(circle at 52% 72%,rgba(232,168,184,.35) 0 9%,transparent 15%),radial-gradient(circle at 80% 74%,rgba(242,196,160,.35) 0 9%,transparent 15%)'), L(`position:absolute;top:6cqh;left:9cqw;font:540 34cqh var(--font-display);line-height:1;color:${IMPRESSION_SUIT[k]};text-shadow:0 0 1.2cqmin ${IMPRESSION_HALO}`, R), L(`position:absolute;bottom:6cqh;right:9cqw;font-size:24cqh;line-height:1;color:${IMPRESSION_SUIT[k]};text-shadow:0 0 1.2cqmin ${IMPRESSION_HALO}`, G)] }),
  AR5: ({ G, R, k }) => ({ extra: 'border:1px solid var(--hairline);background:#f7c948', layers: [L('position:absolute;inset:0;background-image:radial-gradient(circle,#e2542c 2.1cqmin,transparent 2.45cqmin);background-size:9cqmin 9cqmin'), L('position:absolute;left:5cqw;top:5cqh;width:38cqw;height:27cqh;background:#fdf6ec;border:1cqmin solid #1c1a17;border-radius:1.5cqmin;transform:rotate(-3deg);box-shadow:1.2cqmin 1.2cqmin 0 rgba(28,26,23,.35)'), L('position:absolute;left:11cqw;top:8.5cqh;font:800 20cqh var(--font-body);line-height:1;color:#d23a2e;text-shadow:.8cqmin .8cqmin 0 #1c1a17;transform:rotate(-3deg)', R), L('position:absolute;right:5cqw;bottom:5cqh;width:24cqw;height:22cqh;background:#fdf6ec;border:1cqmin solid #1c1a17;border-radius:50%;transform:rotate(4deg)'), L(`position:absolute;right:11cqw;bottom:9cqh;font-size:15cqh;line-height:1;color:${POP_SUIT[k]};transform:rotate(4deg)`, G)] }),
};

// ── MOBILE builders (larger rank/suit; only ids that differ) ──
const MOBILE: Record<string, Builder> = {
  D05a: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [idx(['top', 'left'], C, R, G, 42), idx(['bottom', 'right'], C, R, G, 42)] }),
  D06c: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;top:4cqh;left:6cqw;font:680 30cqh var(--font-display);color:' + C, R), L('position:absolute;top:4cqh;right:6cqw;font:680 30cqh var(--font-display);color:' + C, R), L('position:absolute;bottom:4cqh;left:6cqw;font:680 30cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L('position:absolute;bottom:4cqh;right:6cqw;font:680 30cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L(wm(0.1), G)] }),
  // Corner split (phone): the jumbo pip sits bottom-right with a small
  // breathing margin off the card edge (not cropped into the corner),
  // and the rank gets a clean suit-colored top-left — the centered pip
  // + blend-mode rank collided on wide ranks ("10").
  D16: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;bottom:4cqh;right:4cqw;font-size:64cqh;line-height:1;opacity:.9', G), L('position:absolute;top:6cqh;left:8cqw;font:700 34cqh var(--font-body);line-height:1;letter-spacing:-.03em', R)] }),
  // Offset rings (phone): the emboss ring drops to the bottom-right with
  // a visible breathing margin off the card edge (pip centered inside),
  // freeing a clean top-left for the rank — centered rings collided with
  // wide ranks ("10").
  D42: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;right:5cqw;bottom:5cqh;width:54cqmin;height:54cqmin;border-radius:50%;box-shadow:inset 0 2cqmin 3cqmin rgba(255,255,255,.5),inset 0 -2cqmin 3cqmin rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;font-size:30cqh;line-height:1', G), L('position:absolute;top:6cqh;left:8cqw;font:700 36cqh var(--font-body);line-height:1;letter-spacing:-.03em', R)] }),
  D42a: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;right:4cqw;bottom:4cqh;width:58cqmin;height:58cqmin;border-radius:50%;box-shadow:inset 0 2cqmin 3cqmin rgba(255,255,255,.5),inset 0 -2cqmin 3cqmin rgba(0,0,0,.12)', ''), L(`position:absolute;right:calc(4cqw + 8.5cqmin);bottom:calc(4cqh + 8.5cqmin);width:41cqmin;height:41cqmin;border-radius:50%;border:1cqmin solid ${C};opacity:.4`, ''), L('position:absolute;right:4cqw;bottom:4cqh;width:58cqmin;height:58cqmin;display:flex;align-items:center;justify-content:center;font-size:26cqh;line-height:1', G), L('position:absolute;top:6cqh;left:8cqw;font:700 34cqh var(--font-body);line-height:1;letter-spacing:-.03em', R)] }),
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
  // Music / Space / Art: same art, phone-size rank + pip bumps (the
  // terrain precedent). Prism keeps its 40cqh desktop rank everywhere,
  // like the other rSans skins.
  MU1: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 18% 18%,#ff2079 0 24%,transparent 48%),radial-gradient(circle at 86% 28%,#ffd400 0 26%,transparent 52%),radial-gradient(circle at 22% 86%,#00bfa5 0 26%,transparent 52%),radial-gradient(circle at 82% 82%,#7b2ff7 0 24%,transparent 48%),linear-gradient(#ff6d00,#ff6d00)', layers: [L('position:absolute;top:6cqh;left:8cqw;font:800 42cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#fff8e7;text-shadow:0 .5cqmin 2.5cqmin rgba(36,23,52,.85)', R), L('position:absolute;bottom:5cqh;right:8cqw;font-size:33cqh;line-height:1;color:#fff8e7;text-shadow:0 .5cqmin 2.5cqmin rgba(36,23,52,.85)', G)] }),
  MU2: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#180f33 0%,#2b1257 48%,#611383 78%,#180f33 100%)', layers: [L('position:absolute;left:0;right:0;top:26cqh;margin:auto;width:52cqmin;height:52cqmin;border-radius:50%;background:repeating-linear-gradient(180deg,transparent 0 7cqmin,#180f33 7cqmin 9cqmin),linear-gradient(#ffd319,#ff2975 80%)'), L('position:absolute;left:0;right:0;bottom:0;height:24cqh;background:repeating-linear-gradient(90deg,rgba(255,105,180,.75) 0 .9cqmin,transparent .9cqmin 11cqmin),repeating-linear-gradient(180deg,rgba(255,105,180,.65) 0 .9cqmin,transparent .9cqmin 6.5cqmin),linear-gradient(rgba(24,15,51,.2),#180f33)'), L('position:absolute;top:5cqh;left:7cqw;font:800 40cqh var(--font-body);line-height:1;color:#ffe9f2;text-shadow:0 0 3cqmin #ff2975', R), L('position:absolute;top:6cqh;right:7cqw;font-size:30cqh;line-height:1;color:#ffe9f2;text-shadow:0 0 3cqmin #ff2975', G)] }),
  MU3: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:#101018', layers: [L('position:absolute;left:8cqw;right:8cqw;top:44cqh;bottom:7cqh;background:linear-gradient(180deg,#ff2975 0 22%,#ffd319 22% 46%,#2ee6a8 46% 100%);clip-path:polygon(0 45%,15% 45%,15% 20%,32% 20%,32% 62%,49% 62%,49% 0,66% 0,66% 34%,83% 34%,83% 56%,100% 56%,100% 100%,0 100%)'), L('position:absolute;left:8cqw;right:8cqw;top:44cqh;bottom:7cqh;background:repeating-linear-gradient(90deg,transparent 0 12%,#101018 12% 17%)'), L('position:absolute;top:6cqh;left:8cqw;font:800 40cqh var(--font-body);line-height:1;color:#f4f1ff;text-shadow:0 0 3cqmin rgba(46,230,168,.6)', R), L('position:absolute;top:7cqh;right:8cqw;font-size:30cqh;line-height:1;color:#f4f1ff;text-shadow:0 0 3cqmin rgba(255,41,117,.7)', G)] }),
  MU4: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(200deg,#2c1444,#170b26 70%)', layers: [L('position:absolute;right:5cqw;top:-16cqh;width:46cqmin;height:46cqmin;border-radius:50%;background:repeating-linear-gradient(0deg,rgba(23,11,38,.35) 0 .9cqmin,transparent .9cqmin 6.4cqmin),repeating-linear-gradient(90deg,rgba(23,11,38,.35) 0 .9cqmin,transparent .9cqmin 6.4cqmin),radial-gradient(circle at 35% 30%,#ffffff,#cdd1dd 45%,#8d93a5 80%)'), L('position:absolute;right:2cqw;top:14cqh;width:60cqw;height:82cqh;background:linear-gradient(200deg,rgba(255,182,229,.30),rgba(255,182,229,0) 65%);clip-path:polygon(78% 0,100% 0,58% 100%,18% 100%)'), L('position:absolute;inset:0;background:radial-gradient(circle at 16% 30%,rgba(255,255,255,.9) .5cqmin,transparent 1.2cqmin),radial-gradient(circle at 34% 16%,rgba(255,255,255,.7) .45cqmin,transparent 1.1cqmin),radial-gradient(circle at 24% 60%,rgba(255,255,255,.6) .45cqmin,transparent 1.1cqmin)'), L('position:absolute;bottom:5cqh;left:8cqw;font:800 40cqh var(--font-body);line-height:1;color:#fdeffa;text-shadow:0 0 3.5cqmin rgba(255,120,210,.75)', R), L('position:absolute;bottom:6cqh;right:8cqw;font-size:30cqh;line-height:1;color:#fdeffa;text-shadow:0 0 3.5cqmin rgba(148,214,255,.75)', G)] }),
  SP1: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 28% 22%,#334070 0,#1c2344 42%,#0d1026 100%)', layers: [L('position:absolute;inset:0;background:radial-gradient(circle at 18% 38%,rgba(255,255,255,.95) .6cqmin,transparent 1.4cqmin),radial-gradient(circle at 66% 44%,rgba(255,255,255,.9) .7cqmin,transparent 1.6cqmin),radial-gradient(circle at 56% 84%,rgba(255,255,255,.85) .6cqmin,transparent 1.4cqmin),radial-gradient(circle at 86% 16%,rgba(255,255,255,.75) .5cqmin,transparent 1.2cqmin),radial-gradient(circle at 12% 88%,rgba(255,255,255,.8) .5cqmin,transparent 1.2cqmin)'), L('position:absolute;right:7cqw;bottom:9cqh;width:22cqmin;height:22cqmin;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe3ad,#f2a65a 70%,#c97b3d)'), L('position:absolute;right:1cqw;bottom:14.5cqh;width:34cqmin;height:11cqmin;border:1.3cqmin solid rgba(255,227,173,.75);border-radius:50%;transform:rotate(-22deg)'), L('position:absolute;top:6cqh;left:8cqw;font:700 42cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#e9edff', R), L('position:absolute;bottom:5cqh;left:8cqw;font-size:32cqh;line-height:1;color:#ffd479', G)] }),
  AR1: ({ G, R, k }) => ({ extra: 'border:1px solid var(--hairline);background:#f5efdd', layers: [L('position:absolute;inset:0;background:repeating-conic-gradient(from -34deg at 50% 122%,rgba(176,138,30,.5) 0 2.6deg,transparent 2.6deg 10.4deg)'), L('position:absolute;inset:0;background:linear-gradient(rgba(245,239,221,.95) 26%,rgba(245,239,221,0) 68%)'), L('position:absolute;inset:4cqmin;border:1cqmin solid #b08a1e;border-radius:2.5cqmin'), L(`position:absolute;top:7cqh;left:10cqw;font:680 44cqh var(--font-display);line-height:1;color:${ART_SUIT[k]}`, R), L(`position:absolute;bottom:7cqh;right:10cqw;font-size:32cqh;line-height:1;color:${ART_SUIT[k]}`, G)] }),
  AR2: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:#f8f7f2', layers: [L('position:absolute;left:64%;top:0;right:0;height:58%;background:#c1272d'), L('position:absolute;left:0;bottom:0;width:26%;height:24%;background:#1f4bb8'), L('position:absolute;right:0;bottom:0;width:16%;height:15%;background:#e8b90f'), L('position:absolute;left:64%;top:0;bottom:0;width:2cqmin;background:#1c1a17'), L('position:absolute;left:0;right:0;top:58%;height:2cqmin;background:#1c1a17'), L('position:absolute;left:26%;top:58%;bottom:0;width:2cqmin;background:#1c1a17'), L('position:absolute;right:16%;top:58%;bottom:0;width:2cqmin;background:#1c1a17'), L('position:absolute;top:6cqh;left:8cqw;font:700 40cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#1c1a17', R), L('position:absolute;top:7cqh;right:6cqw;font-size:27cqh;line-height:1;color:#f8f7f2', G)] }),
  AR3: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:#efe9dc', layers: [L('position:absolute;right:-12cqw;top:-12cqh;width:48cqmin;height:48cqmin;border-radius:50%;background:#d23a2e'), L('position:absolute;left:-6cqw;bottom:-6cqh;width:60cqmin;height:60cqmin;background:#e8b90f;clip-path:polygon(0 100%,0 26%,78% 100%)'), L('position:absolute;left:-26cqw;top:22cqh;width:52cqmin;height:52cqmin;border:4.5cqmin solid #1f4bb8;border-radius:50%'), L('position:absolute;left:6cqw;top:56cqh;width:96cqw;height:1.5cqmin;background:#1c1a17;transform:rotate(-24deg)'), L('position:absolute;bottom:4cqh;right:7cqw;font:700 40cqh var(--font-body);line-height:1;letter-spacing:-.03em;color:#1c1a17', R), L('position:absolute;top:7cqh;right:6cqw;font-size:27cqh;line-height:1;color:#fdf6ec', G)] }),
  AR4: ({ G, R, k }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 25% 30%,rgba(232,168,184,.4) 0 30%,transparent 48%),radial-gradient(circle at 75% 25%,rgba(168,196,224,.4) 0 30%,transparent 48%),radial-gradient(circle at 30% 75%,rgba(179,203,166,.4) 0 30%,transparent 48%),radial-gradient(circle at 80% 78%,rgba(195,174,214,.4) 0 30%,transparent 48%),linear-gradient(140deg,#f0e2d6,#e9e2d0)', layers: [L('position:absolute;inset:0;background:radial-gradient(circle at 10% 10%,rgba(232,168,184,.55) 0 15%,transparent 23%),radial-gradient(circle at 64% 12%,rgba(168,196,224,.55) 0 15%,transparent 23%),radial-gradient(circle at 90% 8%,rgba(231,154,142,.5) 0 14%,transparent 22%),radial-gradient(circle at 6% 36%,rgba(179,203,166,.55) 0 15%,transparent 23%),radial-gradient(circle at 58% 34%,rgba(232,168,184,.5) 0 14%,transparent 22%),radial-gradient(circle at 12% 60%,rgba(242,196,160,.55) 0 15%,transparent 23%),radial-gradient(circle at 66% 60%,rgba(195,174,214,.55) 0 15%,transparent 23%),radial-gradient(circle at 92% 58%,rgba(232,168,184,.5) 0 14%,transparent 22%),radial-gradient(circle at 8% 86%,rgba(168,196,224,.5) 0 15%,transparent 23%),radial-gradient(circle at 34% 88%,rgba(231,154,142,.5) 0 14%,transparent 22%),radial-gradient(circle at 62% 86%,rgba(236,217,160,.55) 0 15%,transparent 23%),radial-gradient(circle at 88% 88%,rgba(179,203,166,.5) 0 15%,transparent 23%)'), L(`position:absolute;top:5cqh;left:8cqw;font:540 44cqh var(--font-display);line-height:1;color:${IMPRESSION_SUIT[k]};text-shadow:0 0 1.2cqmin ${IMPRESSION_HALO}`, R), L(`position:absolute;bottom:5cqh;right:8cqw;font-size:32cqh;line-height:1;color:${IMPRESSION_SUIT[k]};text-shadow:0 0 1.2cqmin ${IMPRESSION_HALO}`, G)] }),
  AR5: ({ G, R, k }) => ({ extra: 'border:1px solid var(--hairline);background:#f7c948', layers: [L('position:absolute;inset:0;background-image:radial-gradient(circle,#e2542c 2.1cqmin,transparent 2.45cqmin);background-size:9cqmin 9cqmin'), L('position:absolute;left:4cqw;top:4cqh;width:48cqw;height:33cqh;background:#fdf6ec;border:1cqmin solid #1c1a17;border-radius:2cqmin;transform:rotate(-3deg);box-shadow:1.2cqmin 1.2cqmin 0 rgba(28,26,23,.35)'), L('position:absolute;left:11cqw;top:8.5cqh;font:800 26cqh var(--font-body);line-height:1;color:#d23a2e;text-shadow:.8cqmin .8cqmin 0 #1c1a17;transform:rotate(-3deg)', R), L('position:absolute;right:4cqw;bottom:4cqh;width:30cqw;height:27cqh;background:#fdf6ec;border:1cqmin solid #1c1a17;border-radius:50%;transform:rotate(4deg)'), L(`position:absolute;right:11cqw;bottom:9.5cqh;font-size:19cqh;line-height:1;color:${POP_SUIT[k]};transform:rotate(4deg)`, G)] }),
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
  { id: 'PZ1', name: 'Prism · Facet', family: 'Prism' },
  { id: 'PZ2', name: 'Prism · Shard', family: 'Prism' },
  { id: 'MU1', name: 'Psychedelic melt', family: 'Music' },
  { id: 'MU2', name: 'Synthwave sunset', family: 'Music' },
  { id: 'MU3', name: 'Equalizer', family: 'Music' },
  { id: 'MU4', name: 'Disco ball', family: 'Music' },
  { id: 'SP1', name: 'Cosmos', family: 'Space' },
  { id: 'AR1', name: 'Art deco sunburst', family: 'Art' },
  { id: 'AR2', name: 'De Stijl', family: 'Art' },
  { id: 'AR3', name: 'Bauhaus', family: 'Art' },
  { id: 'AR4', name: 'Impression', family: 'Art' },
  { id: 'AR5', name: 'Pop art', family: 'Art' },
];

export const SKIN_IDS: string[] = SKINS.map((s) => s.id);

/** Ids that render a distinct layout on mobile (all others fall back to desktop). */
export const SKINS_WITH_MOBILE: string[] = Object.keys(MOBILE);

/** Ids whose palette is fixed (not theme-token / suit-color driven). Informational. */
export const SKINS_FIXED_PALETTE: string[] = ['D62c', 'C2', 'D64', 'D67b', 'D69b', 'D65b', 'D70c', 'L1', 'D69c', 'EX6', 'EX16', 'EX17', 'MU1', 'MU2', 'MU3', 'MU4', 'SP1', 'AR1', 'AR2', 'AR3', 'AR4', 'AR5'];

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
