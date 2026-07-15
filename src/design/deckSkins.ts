/* PokerGrid — deck skins (final 27), drop-in for pokergrid-web.
 *
 * These are token-driven CSS card faces — NO image assets. Every color comes from
 * your themes.css custom properties, so each skin recolors per theme (paper / paper-dark /
 * card-room / card-room-dark) and honors the four-color vs two-color deck setting.
 *
 * Usage:
 *   import { renderSkin, SKINS } from './deckSkins';
 *   const face = renderSkin('D27b', 'A', 'h', { four: true });
 *   // face = { wrap: string, layers: Layer[] }  (inline-style strings)
 *
 * Render each layer as an absolutely-positioned <span> inside the wrap container.
 * The container MUST set `container-type: size` (already in `wrap`) so the cqh/cqw/cqmin
 * units resolve — give the outer element a real width/height (e.g. width:82px).
 *
 * Jokers are handled by the game's own joker face; these skins render standard ranks
 * ('A','2'..'10','J','Q','K') and suits ('h','d','c','s').
 */

export type SuitKey = 'h' | 'd' | 'c' | 's';
export interface Layer { style: string; glyph: string; kids: { style: string; glyph: string }[]; }
export interface CardFace { wrap: string; layers: Layer[]; }
export interface RenderOpts { four?: boolean; }

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
const BASE = (extra: string, C: string) =>
  `position:relative;width:100%;aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:var(--card-face);box-shadow:var(--card-shadow,var(--shadow-sm));container-type:size;color:${C};${extra || ''}`;
const rSans = 'position:absolute;top:7cqh;left:9cqw;font:700 40cqh var(--font-body);line-height:1;letter-spacing:-.03em';
const rSerif = 'position:absolute;top:6cqh;left:9cqw;font:680 42cqh var(--font-display);line-height:1;letter-spacing:-.01em';
const pipBR = 'position:absolute;bottom:6cqh;right:9cqw;font-size:32cqh;line-height:1';
const wm = (op: number) => `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:60cqh;line-height:1;opacity:${op};pointer-events:none`;

interface Ctx { C: string; G: string; R: string; k: SuitKey; }
type Builder = (ctx: Ctx) => { extra: string; layers: Layer[] };

const BUILDERS: Record<string, Builder> = {
  // ── base / variant ────────────────────────────────────────────────
  D16: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80cqh;opacity:.9;line-height:1', G), L('position:absolute;top:7cqh;left:9cqw;font:700 20cqh var(--font-body);color:var(--card-face);mix-blend-mode:difference', R)] }),
  D21: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L(`position:absolute;inset:6cqmin;border-radius:5cqmin;border:1.5cqmin solid ${C};opacity:.4`, ''), L(rSans, R), L(pipBR, G)] }),
  D24: ({ G, R }) => ({ extra: 'border:1px dashed var(--rule)', layers: [L('position:absolute;top:50%;left:-4cqmin;width:8cqmin;height:8cqmin;border-radius:50%;background:var(--paper);transform:translateY(-50%)', ''), L('position:absolute;top:50%;right:-4cqmin;width:8cqmin;height:8cqmin;border-radius:50%;background:var(--paper);transform:translateY(-50%)', ''), L(rSans, R), L(pipBR, G)] }),
  D42: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:0;margin:auto;width:60cqmin;height:60cqmin;border-radius:50%;box-shadow:inset 0 2cqmin 3cqmin rgba(255,255,255,.5),inset 0 -2cqmin 3cqmin rgba(0,0,0,.12)', ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:44cqh', G), L('position:absolute;top:7cqh;left:9cqw;font:700 20cqh var(--font-body)', R)] }),
  D64: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#f6e2b3,#e9c682)', layers: [L('position:absolute;left:-10cqw;right:-10cqw;bottom:-14cqh;height:44cqh;border-radius:50%;background:#dcb066', ''), L('position:absolute;left:-10cqw;right:-30cqw;bottom:-6cqh;height:34cqh;border-radius:50%;background:#cfa055', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);color:#7a5321', R), L('position:absolute;top:8cqh;right:9cqw;font-size:24cqh;color:#7a5321', G)] }),
  D05a: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [idx(['top', 'left'], C, R, G, 22), idx(['bottom', 'right'], C, R, G, 22)] }),
  D06c: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;top:5cqh;left:7cqw;font:680 20cqh var(--font-display);color:' + C, R), L('position:absolute;top:5cqh;right:7cqw;font:680 20cqh var(--font-display);color:' + C, R), L('position:absolute;bottom:5cqh;left:7cqw;font:680 20cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L('position:absolute;bottom:5cqh;right:7cqw;font:680 20cqh var(--font-display);transform:rotate(180deg);color:' + C, R), L(wm(0.1), G)] }),
  D27b: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:linear-gradient(150deg,var(--card-face),color-mix(in srgb,${C} 18%,var(--card-face)))`, layers: [L(rSans, R), L(pipBR, G)] }),
  D27c: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:color-mix(in srgb,${C} 9%,var(--card-face))`, layers: [L('position:absolute;inset:5cqmin;border-radius:4cqmin;border:1cqmin solid var(--card-face)', ''), L(rSans, R), L(pipBR, G), L(wm(0.1), G)] }),
  D41c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:5cqmin;border:1cqmin double var(--warn);border-radius:3cqmin;opacity:.7', ''), L(rSerif, R), L(pipBR, G), L(wm(0.08), G)] }),
  D51a: ({ G, R }) => ({ extra: 'border:2px solid var(--card-black);background:color-mix(in srgb,var(--warn) 12%,var(--card-face));clip-path:polygon(0 3%,8% 0,22% 4%,40% 0,60% 4%,80% 0,94% 4%,100% 2%,100% 98%,90% 100%,70% 97%,50% 100%,30% 97%,12% 100%,0 97%)', layers: [L('position:absolute;top:5cqh;left:0;right:0;text-align:center;font:700 8cqh var(--font-display);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)', 'Wanted'), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 44cqh var(--font-display);margin-top:5cqh', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:24cqh', G)] }),
  D55b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline)', layers: [L('position:absolute;inset:5cqmin;border-radius:4cqmin;border:2cqmin dashed var(--warn);opacity:.7', ''), L('position:absolute;top:3cqmin;left:3cqmin;width:5cqmin;height:5cqmin;border-radius:50%;background:var(--warn)', ''), L('position:absolute;bottom:3cqmin;right:3cqmin;width:5cqmin;height:5cqmin;border-radius:50%;background:var(--warn)', ''), L(rSerif, R), L(pipBR, G)] }),
  D62c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:color-mix(in srgb,#f3efe2 75%,var(--card-face))', layers: [L('position:absolute;inset:6cqmin;border:1.5cqmin solid #2f7d4f;border-radius:3cqmin;opacity:.6', ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 48cqh var(--font-display);color:#2f7d4f', R), L('position:absolute;top:8cqh;right:11cqw;font-size:18cqh;color:#b3262e', G)] }),
  D65b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 40% 30%,#e08b6f,#c1573b 75%)', layers: [L('position:absolute;inset:0;background:linear-gradient(60deg,transparent 48%,rgba(0,0,0,.18) 49% 50%,transparent 51%),linear-gradient(-30deg,transparent 60%,rgba(0,0,0,.14) 61% 62%,transparent 63%)', ''), L(rSans + ';color:#fff', R), L(pipBR + ';color:#fff', G)] }),
  D67b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#2d6a4f,#1b4332)', layers: [L('position:absolute;bottom:-4cqh;left:8cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:24cqh solid #40916c', ''), L('position:absolute;bottom:-4cqh;left:36cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:30cqh solid #52b788', ''), L('position:absolute;bottom:-4cqh;right:10cqw;border-left:6cqmin solid transparent;border-right:6cqmin solid transparent;border-bottom:24cqh solid #40916c', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 28cqh var(--font-body);color:#e9f5db', R), L('position:absolute;top:8cqh;right:9cqw;font-size:22cqh;color:#e9f5db', G)] }),
  D69b: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,#e7f5ff,#74c0fc)', layers: [L('position:absolute;inset:0;background:conic-gradient(from 30deg at 60% 40%,rgba(255,255,255,.5),transparent 25%,rgba(255,255,255,.35) 55%,transparent 80%)', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);color:#1864ab', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:26cqh;color:#1864ab', G)] }),
  D69c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(160deg,#caffbf,#9bf6ff 55%,#bdb2ff)', layers: [L('position:absolute;top:7cqh;left:9cqw;font:700 32cqh var(--font-body);color:#1d4e6b', R), L('position:absolute;bottom:6cqh;right:9cqw;font-size:26cqh;color:#1d4e6b', G)] }),
  D70c: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(#cdeac0,#8fd694)', layers: [L('position:absolute;left:-14cqw;right:-14cqw;bottom:-8cqh;height:34cqh;border-radius:50%;background:#5aa469', ''), L('position:absolute;left:-6cqw;right:-30cqw;bottom:-14cqh;height:30cqh;border-radius:50%;background:#3f8f57', ''), L('position:absolute;top:7cqh;left:9cqw;font:700 28cqh var(--font-body);color:#1b4332', R), L('position:absolute;top:8cqh;right:9cqw;font-size:22cqh;color:#1b4332', G)] }),
  // ── refinements ───────────────────────────────────────────────────
  W1: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:linear-gradient(145deg,var(--card-face) 8%,color-mix(in srgb,${C} 32%,var(--card-face)) 96%)`, layers: [L(rSans, R), L(pipBR, G)] }),
  W2: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:linear-gradient(160deg,var(--card-face),color-mix(in srgb,${C} 45%,var(--card-face)))`, layers: [L(rSans, R), L(pipBR, G)] }),
  W3: ({ C, G, R }) => ({ extra: `border:1px solid var(--hairline);background:radial-gradient(circle at 78% 82%,color-mix(in srgb,${C} 42%,var(--card-face)),var(--card-face) 72%)`, layers: [L(rSans, R), L(pipBR, G)] }),
  N1: ({ G, R }) => ({ extra: 'border:2px solid var(--card-black);background:color-mix(in srgb,var(--warn) 12%,var(--card-face));clip-path:polygon(0 3%,8% 0,22% 4%,40% 0,60% 4%,80% 0,94% 4%,100% 2%,100% 98%,90% 100%,70% 97%,50% 100%,30% 97%,12% 100%,0 97%)', layers: [L('position:absolute;inset:5cqmin;border:2cqmin dashed var(--card-black);border-radius:2cqmin;opacity:.55', ''), L('position:absolute;top:6cqh;left:0;right:0;text-align:center;font:700 8cqh var(--font-display);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)', 'Wanted'), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 42cqh var(--font-display);margin-top:5cqh', R), L('position:absolute;bottom:7cqh;right:11cqw;font-size:22cqh', G)] }),
  N2: ({ G, R }) => ({ extra: 'border:2px solid var(--card-black);background:color-mix(in srgb,var(--warn) 18%,var(--card-face));clip-path:polygon(0 3%,8% 0,22% 4%,40% 0,60% 4%,80% 0,94% 4%,100% 2%,100% 98%,90% 100%,70% 97%,50% 100%,30% 97%,12% 100%,0 97%)', layers: [L('position:absolute;inset:5cqmin;border:2cqmin dashed var(--warn);border-radius:2cqmin;opacity:.7', ''), L('position:absolute;top:6cqh;left:0;right:0;text-align:center;font:700 8cqh var(--font-display);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)', 'Wanted'), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 42cqh var(--font-display);margin-top:5cqh', R), L('position:absolute;bottom:7cqh;right:11cqw;font-size:22cqh', G)] }),
  P1: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,color-mix(in srgb,#c9f7d4 55%,var(--card-face)),color-mix(in srgb,#e0c3fc 55%,var(--card-face)))', layers: [L(rSans + ';color:' + C, R), L(pipBR + ';color:' + C, G), L(wm(0.1), G)] }),
  P3: ({ C, G, R }) => ({ extra: 'border:1px solid var(--hairline);background:linear-gradient(135deg,color-mix(in srgb,#ff9ec4 45%,var(--card-face)),color-mix(in srgb,#a5d8ff 45%,var(--card-face)))', layers: [L(rSans + ';color:' + C, R), L(pipBR + ';color:' + C, G), L(wm(0.1), G)] }),
  C2: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:color-mix(in srgb,#efe7d2 80%,var(--card-face))', layers: [L('position:absolute;inset:5cqmin;border:1cqmin double #2f7d4f;border-radius:3cqmin;opacity:.6', ''), L('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:680 46cqh var(--font-display);color:#1e5a3a', R), L('position:absolute;bottom:7cqh;left:0;right:0;text-align:center;font-size:16cqh;color:#b3262e', G)] }),
  L1: ({ G, R }) => ({ extra: 'border:1px solid var(--hairline);background:radial-gradient(circle at 50% 120%,#ffba08,#e85d04 40%,#6a040f 85%)', layers: [L(rSans + ';color:#ffe8c2', R), L(pipBR + ';color:#ffe8c2', G)] }),
};

export interface SkinMeta { id: string; name: string; family: string; }
export const SKINS: SkinMeta[] = [
  { id: 'D05a', name: 'Bold twin index', family: 'Twin corners' },
  { id: 'D06c', name: 'Quad serif', family: 'Quad corners' },
  { id: 'D16', name: 'Jumbo pip + mini rank', family: 'Big pip' },
  { id: 'D21', name: 'Rounded inner keyline', family: 'Keyline' },
  { id: 'D24', name: 'Ticket notch', family: 'Ticket' },
  { id: 'D27b', name: 'Gradient wash', family: 'Suit-color / gradient wash' },
  { id: 'D27c', name: 'Wash + keyline', family: 'Suit-color / gradient wash' },
  { id: 'D41c', name: 'Gilt filigree', family: 'Filigree keyline' },
  { id: 'D42', name: 'Emboss ring', family: 'Emboss ring' },
  { id: 'D51a', name: 'Torn notice', family: 'Wanted poster' },
  { id: 'D55b', name: 'Rope + knots', family: 'Rope frame' },
  { id: 'D62c', name: 'Carved rank', family: 'Bamboo / carved' },
  { id: 'D64', name: 'Sand dunes', family: 'Terrain' },
  { id: 'D65b', name: 'Cracked clay', family: 'Terrain' },
  { id: 'D67b', name: 'Pine rows', family: 'Terrain' },
  { id: 'D69b', name: 'Glacier facets', family: 'Terrain' },
  { id: 'D69c', name: 'Aurora ice', family: 'Terrain' },
  { id: 'D70c', name: 'Rolling hills', family: 'Terrain' },
  { id: 'W1', name: 'Gradient wash · corner fade', family: 'Suit-color / gradient wash' },
  { id: 'W2', name: 'Gradient wash · deep sweep', family: 'Suit-color / gradient wash' },
  { id: 'W3', name: 'Gradient wash · radial glow', family: 'Suit-color / gradient wash' },
  { id: 'N1', name: 'Torn notice · rope', family: 'Wanted poster' },
  { id: 'N2', name: 'Torn notice · warm rope', family: 'Wanted poster' },
  { id: 'P1', name: 'Pastel · mint · lilac', family: 'Pastel wash' },
  { id: 'P3', name: 'Pastel · rose · blue', family: 'Pastel wash' },
  { id: 'C2', name: 'Carved · ivory double-rule', family: 'Bamboo / carved' },
  { id: 'L1', name: 'Lava · clean ember', family: 'Lava' },
];

export const SKIN_IDS = SKINS.map((s) => s.id);

/** Build a card face for a given skin id, rank and suit. */
export function renderSkin(id: string, rank: string, suit: SuitKey, opts: RenderOpts = {}): CardFace {
  const build = BUILDERS[id];
  if (!build) throw new Error(`Unknown skin id: ${id}`);
  const four = opts.four !== false;
  const C = colorFor(suit, four);
  const G = SUITS[suit][0];
  const { extra, layers } = build({ C, G, R: rank, k: suit });
  return { wrap: BASE(extra, C), layers };
}

/* Optional React helper (uncomment if useful):
 *
 * import React from 'react';
 * const styleObj = (s: string): React.CSSProperties => Object.fromEntries(
 *   s.split(';').filter(Boolean).map((d) => {
 *     const i = d.indexOf(':'); const prop = d.slice(0, i).trim(); const val = d.slice(i + 1).trim();
 *     return [prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), val];
 *   })
 * ) as React.CSSProperties;
 *
 * export function CardFaceView({ id, rank, suit, four = true, size = 82 }:
 *   { id: string; rank: string; suit: SuitKey; four?: boolean; size?: number }) {
 *   const { wrap, layers } = renderSkin(id, rank, suit, { four });
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
