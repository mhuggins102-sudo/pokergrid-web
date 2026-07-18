// Every deck skin ships a matching joker face (the theme default keeps the
// app's classic purple star, drawn by CardFace itself). Regression guard:
// a skin added without joker coverage would silently fall back and break
// the "every skin has a corresponding joker" product rule.

import { SKIN_IDS, renderJoker } from '../../design/deckSkins';

describe('renderJoker', () => {
  it.each(SKIN_IDS)('%s renders a joker face on both tiers', id => {
    for (const mobile of [false, true]) {
      const face = renderJoker(id, { mobile });
      expect(face).not.toBeNull();
      expect(face!.wrap).toContain('container-type:size');
      // The composition must actually mark the card as the joker: a star
      // glyph or a JOKER wordmark somewhere in the layer stack.
      const marks = face!.layers.filter(l => /★|joker/i.test(l.glyph));
      expect(marks.length).toBeGreaterThan(0);
    }
  });

  it('returns null for unknown ids (caller falls back to the default joker)', () => {
    expect(renderJoker('nope')).toBeNull();
  });
});
