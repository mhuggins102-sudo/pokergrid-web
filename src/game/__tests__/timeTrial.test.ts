import { seededRng } from '../deck';
import { CHALLENGES, findChallenge } from '../challenges';
import { recipeFor } from '../daily/recipe';
import {
  TIME_TRIAL_CAP,
  TIME_TRIAL_PAR_S,
  TIME_TRIAL_RATE,
  scoreGrid,
  timeTrialAdjust,
} from '../scoring';
import { GameState, newGame, step } from '../state';

const timeTrialGame = (): GameState =>
  newGame('hard', seededRng(42), {
    targetOverride: findChallenge('time-trial').scoreTarget,
    timeTrial: true,
  });

const atElapsed = (seconds: number) => ({
  timeTrial: true,
  elapsedMs: seconds * 1000,
});

describe('Time Trial — timeTrialAdjust', () => {
  it('is zero without the flag, regardless of elapsed', () => {
    expect(timeTrialAdjust({ timeTrial: false, elapsedMs: 0 })).toBe(0);
    expect(timeTrialAdjust({})).toBe(0);
    expect(timeTrialAdjust({ elapsedMs: 10_000_000 })).toBe(0);
  });

  it('pays the linear rate under par and costs it over', () => {
    // Exactly at par: zero.
    expect(timeTrialAdjust(atElapsed(TIME_TRIAL_PAR_S))).toBe(0);
    // 60s under par → +30 at 0.5/s.
    expect(timeTrialAdjust(atElapsed(TIME_TRIAL_PAR_S - 60))).toBe(
      Math.round(60 * TIME_TRIAL_RATE)
    );
    // 60s over par → −30.
    expect(timeTrialAdjust(atElapsed(TIME_TRIAL_PAR_S + 60))).toBe(
      -Math.round(60 * TIME_TRIAL_RATE)
    );
  });

  it('clamps both ways', () => {
    // t=0 would be par × rate = 150 raw → capped.
    expect(timeTrialAdjust(atElapsed(0))).toBe(TIME_TRIAL_CAP);
    // An hour over par → capped at the penalty floor.
    expect(timeTrialAdjust(atElapsed(TIME_TRIAL_PAR_S + 3600))).toBe(
      -TIME_TRIAL_CAP
    );
  });

  it('missing elapsedMs (hydrated old state) reads as zero elapsed', () => {
    expect(timeTrialAdjust({ timeTrial: true })).toBe(TIME_TRIAL_CAP);
  });
});

describe('Time Trial — CLOCK_TICK reducer', () => {
  it('is pure: the same action twice yields equal states', () => {
    const s = timeTrialGame();
    const action = { type: 'CLOCK_TICK' as const, elapsedMs: 5000 };
    const a = step(s, action);
    const b = step(s, action);
    expect(a).toEqual(b);
    expect(a.elapsedMs).toBe(5000);
    // Nothing else moved: same phase/grid/history references.
    expect(a.phase).toBe(s.phase);
    expect(a.grid).toBe(s.grid);
    expect(a.history).toBe(s.history);
  });

  it('no-ops (same reference) without the flag', () => {
    const s = newGame('hard', seededRng(42), { targetOverride: 500 });
    expect(step(s, { type: 'CLOCK_TICK', elapsedMs: 5000 })).toBe(s);
  });

  it('no-ops (same reference) on non-advancing ticks', () => {
    let s = timeTrialGame();
    s = step(s, { type: 'CLOCK_TICK', elapsedMs: 5000 });
    expect(step(s, { type: 'CLOCK_TICK', elapsedMs: 5000 })).toBe(s);
    expect(step(s, { type: 'CLOCK_TICK', elapsedMs: 3000 })).toBe(s);
  });

  it('no-ops (same reference) after game over', () => {
    let s = timeTrialGame();
    s = { ...s, phase: { kind: 'game-over' } };
    expect(step(s, { type: 'CLOCK_TICK', elapsedMs: 99_000 })).toBe(s);
  });

  it('ticks push no undo snapshots', () => {
    const s = timeTrialGame();
    const after = step(s, { type: 'CLOCK_TICK', elapsedMs: 5000 });
    expect(after.past.length).toBe(s.past.length);
  });

  it('UNDO never rewinds the clock', () => {
    let s = timeTrialGame();
    // Commit a move at 5s, tick on to 20s, then undo the move: the
    // board rewinds, the clock keeps the later value.
    s = step(s, { type: 'CLOCK_TICK', elapsedMs: 5000 });
    s = step(s, { type: 'PLACE' });
    s = step(s, { type: 'CLOCK_TICK', elapsedMs: 20_000 });
    s = step(s, { type: 'UNDO' });
    expect(s.elapsedMs).toBe(20_000);
  });
});

describe('Time Trial — scoring integration', () => {
  it('the adjustment is a flat term outside the grid multiplier', () => {
    const s = timeTrialGame();
    const base = scoreGrid(s.grid, s.bonusCards, {
      deckRemaining: s.deck.length,
    });
    const fast = scoreGrid(s.grid, s.bonusCards, {
      deckRemaining: s.deck.length,
      timeAdjust: 80,
    });
    const slow = scoreGrid(s.grid, s.bonusCards, {
      deckRemaining: s.deck.length,
      timeAdjust: -45,
    });
    expect(base.timeAdjust).toBe(0);
    expect(fast.timeAdjust).toBe(80);
    expect(fast.total).toBe(base.total + 80);
    expect(slow.total).toBe(base.total - 45);
  });
});

describe('Time Trial — challenge catalog', () => {
  it('is listed last and configured', () => {
    const c = CHALLENGES[CHALLENGES.length - 1];
    expect(c.id).toBe('time-trial');
    expect(c.name).toBe('Time Trial');
    expect(c.scoreTarget).toBe(500);
  });

  it('newGame wires the flag and a zeroed clock', () => {
    const s = timeTrialGame();
    expect(s.timeTrial).toBe(true);
    expect(s.elapsedMs).toBe(0);
    // …and standard games stay clock-free.
    const plain = newGame('hard', seededRng(42));
    expect(plain.timeTrial).toBe(false);
  });

  it('never appears in the daily rotation', () => {
    // A year of recipes — the twist channel must never pick it (it is
    // absent from ALL_TWISTS; the zero weight is belt-and-braces).
    for (let i = 0; i < 366; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      expect(recipeFor(iso).twist).not.toBe('time-trial');
    }
  });
});
