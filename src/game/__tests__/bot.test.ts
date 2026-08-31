import { describe, expect, it } from 'vitest';
import { createBot, playBotGame, runBotGame } from '../bot';
import { seededRng } from '../deck';
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
