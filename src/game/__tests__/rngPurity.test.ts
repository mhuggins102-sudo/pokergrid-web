import { seededRng } from '../deck';
import { Action, GameState, newGame, step } from '../state';

/**
 * The daily's "same puzzle worldwide" promise rests on step() being a
 * pure function of (state, action): React may invoke a reducer more
 * than once per action, so any hidden mutable RNG desyncs seeded runs.
 * These tests pin the purity contract and its two corollaries — repeat
 * invocation is idempotent, and UNDO rewinds the stream so undo + redo
 * replays the identical outcome instead of granting a re-roll.
 *
 * Scatter is used as the driver because it consumes the stream on every
 * draw (the most rng-hungry mode).
 */

const scatterGame = (seed: number): GameState =>
  newGame(
    'hard',
    seededRng(seed),
    500,
    undefined,
    false,
    false,
    [],
    [],
    [],
    false,
    false,
    [],
    undefined,
    0,
    true // scatter
  );

// Drive a game forward with PLACE (the rng-consuming commit) — skipping
// is fine when a phase interlude appears; scatter games place-only run
// to completion.
const PLACE: Action = { type: 'PLACE' };

describe('step purity (rng owned by state)', () => {
  test('newGame is deterministic from the seed, including rngState', () => {
    const a = scatterGame(42);
    const b = scatterGame(42);
    expect(b).toEqual(a);
    expect(typeof a.rngState).toBe('number');
  });

  test('calling step twice with the same state + action gives identical results', () => {
    let s = scatterGame(7);
    for (let i = 0; i < 40 && s.phase.kind !== 'game-over'; i++) {
      const once = step(s, PLACE);
      const twice = step(s, PLACE);
      expect(twice).toEqual(once);
      s = once;
    }
    expect(s.phase.kind).toBe('game-over');
  });

  test('two full seeded runs with identical actions produce identical end states', () => {
    const run = (): GameState => {
      let s = scatterGame(1234);
      for (let i = 0; i < 80 && s.phase.kind !== 'game-over'; i++) {
        s = step(s, PLACE);
      }
      return s;
    };
    const a = run();
    const b = run();
    expect(a.phase.kind).toBe('game-over');
    expect(b).toEqual(a);
  });

  test('rejected actions do not advance the stream', () => {
    const s = scatterGame(9);
    // DISCARD in a fresh scatter state with a joker drawn is impossible;
    // instead use an action that's guaranteed illegal in this phase.
    const rejected = step(s, { type: 'RESOLVE_MEGA_DESTROY' });
    expect(rejected).toBe(s);
  });

  test('UNDO rewinds the stream: undo + redo replays the identical outcome', () => {
    let s = scatterGame(555);
    // Advance a few turns so the grid has texture.
    for (let i = 0; i < 5; i++) s = step(s, PLACE);
    const first = step(s, PLACE);
    const undone = step(first, { type: 'UNDO' });
    expect(undone.rngState).toBe(s.rngState);
    const redone = step(undone, PLACE);
    // Same grid, same scatter target, same deck — only undo bookkeeping
    // (undoCount, past) may differ.
    expect(redone.grid).toEqual(first.grid);
    expect(redone.scatterSlot).toBe(first.scatterSlot);
    expect(redone.deck).toEqual(first.deck);
    expect(redone.rngState).toBe(first.rngState);
    expect(redone.undoCount).toBe(first.undoCount + 1);
  });

  test('legacy rngOverride still owns the stream (state word untouched)', () => {
    const s = scatterGame(2);
    const rng = seededRng(999);
    const next = step(s, PLACE, rng);
    expect(next.rngState).toBe(s.rngState);
  });
});
