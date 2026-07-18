import { CSSProperties } from 'react';
import { SuitKey, renderJoker, renderSkin } from '../../../design/deckSkins';

// Claude Design's skins hand back inline-STYLE STRINGS (built for a
// framework-agnostic gallery). Parse them into React style objects once
// per unique (skin, rank, suit, four) and cache — the same face is drawn
// on up to 25 grid cells and re-rendered on every game action, so parsing
// on each render would be wasteful.

const styleObj = (s: string): CSSProperties =>
  Object.fromEntries(
    s
      .split(';')
      .filter(Boolean)
      .map(decl => {
        const i = decl.indexOf(':');
        const prop = decl.slice(0, i).trim();
        const val = decl.slice(i + 1).trim();
        return [prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), val];
      })
  ) as CSSProperties;

export interface ParsedLayer {
  style: CSSProperties;
  glyph: string;
  kids: { style: CSSProperties; glyph: string }[];
}
export interface ParsedFace {
  wrap: CSSProperties;
  layers: ParsedLayer[];
}

const cache = new Map<string, ParsedFace>();

/** Parsed, cached card face for a skin — ready to spread as React styles.
 *  `mobile` selects the small-screen layout for skins that ship one (the app
 *  passes it on the phone tier); the desktop layout is the default. */
const parse = (wrap: string, layers: { style: string; glyph: string; kids: { style: string; glyph: string }[] }[]): ParsedFace => ({
  wrap: styleObj(wrap),
  layers: layers.map(l => ({
    style: styleObj(l.style),
    glyph: l.glyph,
    kids: l.kids.map(k => ({ style: styleObj(k.style), glyph: k.glyph })),
  })),
});

export const skinFace = (
  id: string,
  rank: string,
  suit: SuitKey,
  four: boolean,
  mobile = false
): ParsedFace => {
  const key = `${id}|${rank}|${suit}|${four ? 4 : 2}|${mobile ? 'm' : 'd'}`;
  let face = cache.get(key);
  if (!face) {
    const { wrap, layers } = renderSkin(id, rank, suit, { four, mobile });
    face = parse(wrap, layers);
    cache.set(key, face);
  }
  return face;
};

const jokerCache = new Map<string, ParsedFace | null>();

/** Parsed, cached JOKER face for a skin — null when the skin has none
 *  (the caller falls back to the app's default joker). */
export const skinJokerFace = (id: string, mobile = false): ParsedFace | null => {
  const key = `${id}|${mobile ? 'm' : 'd'}`;
  let face = jokerCache.get(key);
  if (face === undefined) {
    const built = renderJoker(id, { mobile });
    face = built ? parse(built.wrap, built.layers) : null;
    jokerCache.set(key, face);
  }
  return face;
};
