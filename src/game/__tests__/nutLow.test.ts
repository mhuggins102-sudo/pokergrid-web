import { Card, isJoker } from '../cards';
import { seededRng } from '../deck';
import { LIVE_CHALLENGES, findChallenge, goalForRun } from '../challenges';
import { dailyTargetFor, recipeFor } from '../daily/recipe';
import { GameState, newGame } from '../state';
import { setupForMode } from '../../features/game/modes';

// The real challenge configuration, mirroring modes.ts's 'nut-low' case.
const nutLowGame = (seed = 7) =>
  newGame('hard', seededRng(seed), {
    targetOverride: findChallenge('nut-low').scoreTarget,
    noBonusCards: true,
    lowball: true,
    noJokers: true,
    deckLimit: findChallenge('nut-low').deckLimit,
  });

// Every physical card the deal touched: still in the deck, already on
// the grid, or in hand as the drawn card.
const allCards = (s: GameState): Card[] => [
  ...s.deck,
  ...s.grid.filter((c): c is Card => c !== null),
  ...(s.drawn ? [s.drawn] : []),
];

describe('Nut Low — newGame wiring', () => {
  it('sets the lowball flag and strips every bonus card', () => {
    const s = nutLowGame();
    expect(s.lowball).toBe(true);
    expect(s.noBonusCards).toBe(true);
    expect(s.bonusCards).toEqual([]);
    expect(s.bonusDeck).toEqual([]);
    expect(s.handBoost).toEqual({});
  });

  it('deals a 44-card deck with no joker anywhere', () => {
    for (const seed of [1, 7, 42]) {
      const cards = allCards(nutLowGame(seed));
      expect(cards).toHaveLength(44);
      expect(cards.some(isJoker)).toBe(false);
    }
  });

  it('standard games stay high-hand scored with a full deck', () => {
    const plain = newGame('hard', seededRng(7));
    expect(plain.lowball).toBe(false);
    expect(allCards(plain)).toHaveLength(53); // 52 + Hard's 1 joker
  });

  it('setupForMode wires the challenge route', () => {
    const setup = setupForMode({ kind: 'challenge', id: 'nut-low' });
    expect(setup.target).toBe(400);
    const s = setup.start(seededRng(3));
    expect(s.lowball).toBe(true);
    expect(s.noBonusCards).toBe(true);
    expect(s.target).toBe(400);
    const cards = allCards(s);
    expect(cards).toHaveLength(44);
    expect(cards.some(isJoker)).toBe(false);
  });

  it('daily twists trim to 44 — Hard jokerless, Easy jokers in the pool', () => {
    // Hand-built recipes (Nut Low isn't in the rotation yet): the daily
    // wiring must mirror the challenge on Hard, and on Easy the 10
    // random removals come from the full 54-card deck — jokers merely
    // MAY survive.
    const hard = setupForMode({
      kind: 'daily',
      dateISO: '2026-06-01',
      recipe: { difficulty: 'hard', twist: 'nut-low' },
    }).start(seededRng(5));
    expect(hard.lowball).toBe(true);
    expect(hard.target).toBe(400);
    expect(allCards(hard)).toHaveLength(44);
    expect(allCards(hard).some(isJoker)).toBe(false);

    const easy = setupForMode({
      kind: 'daily',
      dateISO: '2026-06-01',
      recipe: { difficulty: 'easy', twist: 'nut-low' },
    }).start(seededRng(5));
    expect(easy.lowball).toBe(true);
    expect(easy.target).toBe(400);
    expect(allCards(easy)).toHaveLength(44);
    const jokers = allCards(easy).filter(isJoker).length;
    expect(jokers).toBeGreaterThanOrEqual(0);
    expect(jokers).toBeLessThanOrEqual(2);
  });
});

describe('Nut Low — challenge catalog', () => {
  it('closes the catalog, directly below Five Draw, at a flat 400', () => {
    const idx = LIVE_CHALLENGES.findIndex(ch => ch.id === 'nut-low');
    expect(idx).toBe(LIVE_CHALLENGES.length - 1);
    expect(LIVE_CHALLENGES[idx - 1]?.id).toBe('draw-poker');
    const c = LIVE_CHALLENGES[idx];
    expect(c.name).toBe('Nut Low');
    expect(c.scoreTarget).toBe(400);
    // The daily-target rewrite (DailyDay) needs the goal to open with
    // the score sentence.
    expect(c.goal.startsWith('Score 400+ points')).toBe(true);
  });

  it('uses the fixed twist target at every difficulty', () => {
    expect(dailyTargetFor('hard', 'nut-low')).toBe(400);
    expect(dailyTargetFor('easy', 'nut-low')).toBe(400);
  });

  it('goalForRun adjusts the target sentence and the deck parenthetical', () => {
    const c = findChallenge('nut-low');
    // Hard: the catalog copy verbatim (joker + 8 random removed).
    expect(goalForRun(c, 400, 'hard')).toBe(c.goal);
    // Easy/Medium dailies keep jokers in the random trim pool.
    expect(goalForRun(c, 400, 'easy')).toContain(
      '(with 10 cards removed at random, jokers included in the pool)'
    );
    expect(goalForRun(c, 400, 'medium')).toContain(
      '(with 9 cards removed at random, jokers included in the pool)'
    );
    // The target sentence follows the run's actual target — Five Draw
    // is a flat 500 on every difficulty, so its copy never changes.
    const five = findChallenge('draw-poker');
    expect(goalForRun(five, 500, 'easy')).toBe(five.goal);
    expect(goalForRun(five, 500, 'hard')).toBe(five.goal);
    // Short Deck: Easy's two-joker 54-card pool trims 9 to reach 45;
    // Medium matches Hard at 8 (one joker either way).
    const shortDeck = findChallenge('short-deck');
    expect(goalForRun(shortDeck, 400, 'easy')).toContain(
      '9 cards are removed at random'
    );
    expect(goalForRun(shortDeck, 450, 'medium')).toContain(
      '8 cards are removed at random'
    );
    expect(goalForRun(shortDeck, 500, 'hard')).toBe(shortDeck.goal);
  });

  it('stays out of the daily rotation while the target is calibrated', () => {
    for (let i = 0; i < 366; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      expect(recipeFor(iso).twist).not.toBe('nut-low');
    }
  });
});
