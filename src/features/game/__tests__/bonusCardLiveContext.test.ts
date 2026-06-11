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

  it('shows perk usage for Burnout and Frugal plus live grid status', () => {
    const burnout = bonusCardLiveContext(cardById('burnout-x1_25'), state);
    expect(burnout[0]).toBe('Suit perks spent so far: 0');
    expect(burnout[1]).toBe('Not active yet'); // 0 perks < 20
    const frugal = bonusCardLiveContext(cardById('frugal-x1_5'), state);
    expect(frugal[0]).toBe('Suit perks spent so far: 0');
    expect(frugal[1]).toMatch(/^If the game ended now: ×1\.5$/); // 0 ≤ 14
  });

  it('shows deck count for Speedrun with the projected multiplier', () => {
    const lines = bonusCardLiveContext(cardById('deck-bank-x1_05'), state);
    expect(lines[0]).toBe(`Deck cards remaining: ${state.deck.length}`);
    expect(lines[1]).toMatch(/^If the game ended now: ×/);
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

  it('reports per-line firing status for line cards', () => {
    const lines = bonusCardLiveContext(cardById('rainbow-line-x2'), state);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^(Not firing on any line yet|Firing on \d+ lines? right now)$/);
  });

  it('names the hand for hand-type cards', () => {
    const handCard = BONUS_DECK_POOL.find(c => c.id.startsWith('hand-pair'));
    expect(handCard).toBeDefined();
    const lines = bonusCardLiveContext(handCard!, state);
    expect(lines[0]).toMatch(/^(Lines scoring Pair right now: \d+|No line scores this hand yet)$/);
  });
});
