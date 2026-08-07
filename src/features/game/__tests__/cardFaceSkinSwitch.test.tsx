import { act, render } from '@testing-library/react';
import { Card } from '../../../game/cards';
import {
  DEFAULT_SETTINGS,
  useSettingsStore,
} from '../../settings/settingsStore';
import { CardFace } from '../components/CardFace';

/*
 * Mid-game skin switches must REMOUNT the skinned face DOM, not diff the
 * new skin's inline styles onto the surviving spans: React skips
 * re-writing declarations whose values look unchanged, so a re-applied
 * shorthand (`font`, `background`) silently resets a longhand the two
 * skins "share" (`line-height:1`, `background-origin:border-box`) and the
 * face misrenders until something else forces a remount. Worst on Ivory
 * (C2), whose whole design is two line-height:1 centered text layers.
 * The keyed SkinnedFace guarantees the remount; this pins node identity.
 */
describe('CardFace deck-skin switch', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, deckSkin: 'D62c' });
  });
  afterEach(() => {
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });

  const ace: Card = { kind: 'standard', rank: 'A', suit: 'H' };
  const joker: Card = { kind: 'joker' };

  it.each([
    ['standard card', ace],
    ['joker', joker],
  ] as const)('remounts the %s face when the skin changes', (_label, card) => {
    const { container } = render(<CardFace card={card} />);
    const before = container.querySelector('[data-skin]');
    expect(before).not.toBeNull();
    expect(before!.getAttribute('data-skin')).toBe('D62c');

    act(() => {
      useSettingsStore.setState({ deckSkin: 'C2' });
    });

    const after = container.querySelector('[data-skin]');
    expect(after).not.toBeNull();
    expect(after!.getAttribute('data-skin')).toBe('C2');
    expect(after).not.toBe(before);
  });
});
