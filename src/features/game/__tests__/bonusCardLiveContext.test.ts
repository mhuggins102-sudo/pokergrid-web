import { seededRng } from '../../../game/deck';
import { newGame } from '../../../game/state';
import { BONUS_DECK_POOL } from '../../../game/bonusCards';
import { bonusCardLiveContext } from '../bonusCardLiveContext';

const cardById = (id: string) => {
  const c = BONUS_DECK_POOL.find(c => c.id === id);
  if (!c) throw new Error(`missing ${id}`);
  return c;
};

describe('bonusCardLiveContext', () => {
  const state = newGame('easy', seededRng(7));

  it('shows perk usage for Burnout and Frugal', () => {
    expect(bonusCardLiveContext(cardById('burnout-x1_25'), state)).toEqual([
      'Suit perks spent so far: 0',
    ]);
    expect(bonusCardLiveContext(cardById('frugal-x1_5'), state)).toEqual([
      'Suit perks spent so far: 0',
    ]);
  });

  it('shows deck count for Speedrun', () => {
    expect(bonusCardLiveContext(cardById('deck-bank-x1_05'), state)).toEqual([
      `Deck cards remaining: ${state.deck.length}`,
    ]);
  });

  it('shows joker counts for joker-keyed cards', () => {
    expect(
      bonusCardLiveContext(cardById('trash-joker-x1_25'), state)[0]
    ).toMatch(/^Jokers destroyed so far: \d+$/);
    expect(
      bonusCardLiveContext(cardById('joker-line-x1_5'), state)[0]
    ).toMatch(/^Jokers on the board: \d+$/);
  });

  it('shows board counts for suit-density cards and strips power suffixes', () => {
    const density = BONUS_DECK_POOL.find(c => c.id.startsWith('suit-density-h'));
    expect(density).toBeDefined();
    const powered = { ...density!, id: `${density!.id}-pwr1` };
    const lines = bonusCardLiveContext(powered, state);
    expect(lines[0]).toMatch(/^♥ Hearts on the board: \d+$/);
  });

  it('stays silent for cards without a live counter', () => {
    expect(bonusCardLiveContext(cardById('rainbow-line-x2'), state)).toEqual([]);
  });
});
