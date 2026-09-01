import { describe, expect, it } from 'vitest';
import {
  createBot,
  fitAt,
  heuristicMults,
  playBotGame,
  projectFill,
  runBotGame,
} from '../bot';
import { Card, Rank, StandardCard, Suit } from '../cards';
import { seededRng } from '../deck';
import { Grid, emptyGrid } from '../grid';
import { Difficulty } from '../rules';
import { GameState, newGame, step } from '../state';

// Small sample counts keep these fast — correctness properties
// (determinism, order-blindness, legality) hold at any sample size.
const SAMPLES = 3;

describe('bot determinism', () => {
  it('replays the same (difficulty, seed) to the same score and trace', () => {
    const a = runBotGame('easy', 42, { samples: SAMPLES });
    const b = runBotGame('easy', 42, { samples: SAMPLES });
    expect(a.report.total).toBe(b.report.total);
    expect(a.actions).toEqual(b.actions);
    expect(a.state.phase.kind).toBe('game-over');
  }, 30_000);
});

describe('bot honesty — order-blindness', () => {
  // The bot may know WHICH cards remain (perfect card counting), but
  // never their order. Structural guarantee: the evaluator sorts the
  // deck before sampling shuffles, so permuting the true order can't
  // change any decision. Pin it: walk the bot through a real game and,
  // at every awaiting-action decision, ask two same-seeded bots for a
  // move — one seeing the true deck, one seeing it reversed.
  it('decisions are identical under a permuted deck order', () => {
    let s: GameState = newGame('hard', seededRng(7));
    const driver = createBot(1, SAMPLES);
    let decisionsChecked = 0;
    for (let i = 0; i < 80 && s.phase.kind !== 'game-over'; i++) {
      if (s.phase.kind === 'awaiting-action' && s.deck.length > 1) {
        const reversed: GameState = { ...s, deck: [...s.deck].reverse() };
        const fromTrue = createBot(99, SAMPLES).pickAction(s);
        const fromPermuted = createBot(99, SAMPLES).pickAction(reversed);
        expect(fromPermuted).toEqual(fromTrue);
        decisionsChecked++;
      }
      s = step(s, driver.pickAction(s));
    }
    // The walk must have exercised real decisions, not vacuously passed.
    expect(decisionsChecked).toBeGreaterThan(5);
  });
});

describe('slack-aware rollout (projectFill)', () => {
  const C = (rank: Rank, suit: Suit): StandardCard => ({
    kind: 'standard',
    rank,
    suit,
  });
  // A rollout player with no held bonus cards and a zero bar: it
  // passes on any card that lowers its lines' outlook while a spare
  // card remains, and places everything else.
  const policy = { skip: true, scale: 0, mults: heuristicMults([]) };
  const plain = { ...policy, skip: false };

  // A board with ONE empty slot (2 — row 0, col 2). Row 0 carries a
  // pair of kings; a dealt K♦ makes trips there while a 2♦ only kills
  // the row's two-pair / trips draw.
  const oneOpenSlot = (): Grid => {
    const g = emptyGrid();
    const row0 = [C('K', 'H'), C('K', 'C'), null, C('9', 'S'), C('8', 'H')];
    for (let i = 0; i < 5; i++) g[i] = row0[i];
    const fillers: Rank[] = ['3', '4', '5', '6', '7'];
    for (let i = 5; i < 25; i++) {
      g[i] = C(fillers[i % 5], (['H', 'S', 'C', 'D'] as Suit[])[i % 4]);
    }
    g[2] = null;
    return g;
  };

  it('scores a pairing card as a better fit than a dead one', () => {
    const g = oneOpenSlot();
    expect(fitAt(g, 2, C('K', 'D'))).toBeGreaterThan(fitAt(g, 2, C('2', 'D')));
  });

  it('weighs fits by the held hand-type multipliers', () => {
    const g = oneOpenSlot();
    const tripsBoost = heuristicMults([
      { id: 'hand-three_of_a_kind-x3', multValue: 3 } as never,
    ]);
    expect(fitAt(g, 2, C('K', 'D'), tripsBoost)).toBeGreaterThan(
      fitAt(g, 2, C('K', 'D'))
    );
  });

  it('passes on a harmful card while a spare remains, landing the fitting one', () => {
    const { grid, deckRem } = projectFill(
      oneOpenSlot(),
      [C('2', 'D'), C('K', 'D'), C('3', 'D')],
      policy
    );
    expect(grid[2]).toEqual(C('K', 'D'));
    expect(deckRem).toBe(1); // skipped 2♦ consumed; 3♦ never dealt
  });

  it('never passes when the deck could no longer refill the grid', () => {
    const { grid } = projectFill(oneOpenSlot(), [C('2', 'D')], policy);
    expect(grid[2]).toEqual(C('2', 'D'));
  });

  it('never skips a joker, and plain fill never skips at all', () => {
    const joker: Card = { kind: 'joker' };
    expect(
      projectFill(oneOpenSlot(), [joker, C('K', 'D')], policy).grid[2]
    ).toEqual(joker);
    expect(
      projectFill(oneOpenSlot(), [C('2', 'D'), C('K', 'D')], plain).grid[2]
    ).toEqual(C('2', 'D'));
  });
});

describe('bot completes real games', () => {
  const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
  it.each(DIFFICULTIES)('finishes a %s free-play run legally', difficulty => {
    const run = runBotGame(difficulty, 11, { samples: 2 });
    expect(run.state.phase.kind).toBe('game-over');
    expect(Number.isFinite(run.report.total)).toBe(true);
    expect(run.actions.length).toBeGreaterThan(20);
  });

  it('the action trace replays to the same final state', () => {
    const run = runBotGame('medium', 5, { samples: 2 });
    let s = newGame('medium', seededRng(5));
    for (const action of run.actions) s = step(s, action);
    expect(s.phase.kind).toBe('game-over');
    expect(s.grid).toEqual(run.state.grid);
  });

  it('playBotGame works from a caller-constructed state (sim harness path)', () => {
    const initial = newGame('hard', seededRng(3), {
      targetOverride: 300,
      noBonusCards: true,
    });
    const run = playBotGame(initial, { samples: 2, botSeed: 8 });
    expect(run.state.phase.kind).toBe('game-over');
  });
});
