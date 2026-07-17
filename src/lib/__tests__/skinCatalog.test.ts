import { describe, expect, it } from 'vitest';
import { SKIN_CATALOG } from '../../design/skinCatalog';
import { SKINS } from '../../design/deckSkins';
import { MAX_LEVEL } from '../xp';

describe('skin catalog', () => {
  it('grants exactly one entry per level 1…MAX_LEVEL (no skipped levels)', () => {
    const levels = SKIN_CATALOG.map(u => u.level).sort((a, b) => a - b);
    expect(levels).toEqual(
      Array.from({ length: MAX_LEVEL }, (_, i) => i + 1)
    );
  });

  it('assigns every skin id exactly once', () => {
    const ids = SKIN_CATALOG.flatMap(u => u.skinIds);
    expect(ids.sort()).toEqual(SKINS.map(s => s.id).sort());
  });
});
