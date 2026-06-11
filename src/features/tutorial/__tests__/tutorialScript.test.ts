import { describe, expect, it } from 'vitest';
import { Card } from '../../../game/cards';
import { seededRng } from '../../../game/deck';
import { Action, GameState, step as reduce } from '../../../game/state';
import {
  TUTORIAL_OPENING,
  TUTORIAL_TARGET,
  tutorialStart,
} from '../tutorialGame';
import { TUTORIAL_STEPS } from '../tutorialSteps';

/**
 * Drives the handcrafted deal through the reducer making exactly the
 * moves the coach asks for, while walking the step script's gate the
 * same way TutorialPage does. Fails if the deck order and the step
 * copy/gating ever drift apart.
 */

const std = (rank: string, suit: string) =>
  ({ kind: 'standard', rank, suit }) as Card;

describe('tutorial script', () => {
  it('is deterministic', () => {
    expect(tutorialStart()).toEqual(tutorialStart());
  });

  it('scripted deal and coach steps stay in lockstep', () => {
    const rng = seededRng(1);
    let s: GameState = tutorialStart();

    // Mirror of TutorialPage's gate walk: info steps advance via Next,
    // action steps must allow the dispatch and advance on completion.
    let stepIndex = 0;
    const dispatch = (a: Action) => {
      while (TUTORIAL_STEPS[stepIndex].kind === 'info') stepIndex++;
      const cur = TUTORIAL_STEPS[stepIndex];
      expect(cur.kind, `step ${cur.id} should be an action step`).toBe(
        'action'
      );
      expect(
        a.type === 'CANCEL_ACTION' || cur.allows!(a),
        `step ${cur.id} should allow ${a.type}`
      ).toBe(true);
      s = reduce(s, a, rng);
      if (cur.completes!(a)) stepIndex++;
    };

    expect(s.target).toBe(TUTORIAL_TARGET);
    expect(s.grid[12]).toEqual(std('7', 'H'));
    expect(s.drawn).toEqual(TUTORIAL_OPENING[0]);

    // 1-3: three places along the spiral (13, 18, 17).
    dispatch({ type: 'PLACE' }); // K♠ → 13
    expect(s.grid[13]).toEqual(std('K', 'S'));
    dispatch({ type: 'PLACE' }); // 4♣ → 18
    expect(s.grid[18]).toEqual(std('4', 'C'));
    dispatch({ type: 'PLACE' }); // K♦ → 17
    expect(s.grid[17]).toEqual(std('K', 'D'));

    // 4: ♥ swap — the coach's suggested pair (17 ↔ 18) must be legal.
    expect(s.drawn).toEqual(std('9', 'H'));
    dispatch({ type: 'BEGIN_SUIT_ACTION' });
    expect(s.phase.kind).toBe('awaiting-target-hop');
    const pairs = (s.phase as { pairs: [number, number][] }).pairs;
    const kingsPair = pairs.find(
      ([i, j]) => (i === 17 && j === 18) || (i === 18 && j === 17)
    );
    expect(kingsPair, 'swap 17↔18 must be offered').toBeDefined();
    dispatch({ type: 'RESOLVE_HOP', i: kingsPair![0], j: kingsPair![1] });
    expect(s.grid[18]).toEqual(std('K', 'D')); // kings now share column 3
    expect(s.grid[17]).toEqual(std('4', 'C'));

    // 5: place the junk 2♣ → 16.
    expect(s.drawn).toEqual(std('2', 'C'));
    dispatch({ type: 'PLACE' });
    expect(s.grid[16]).toEqual(std('2', 'C'));

    // 6: ♦ destroy the 2♣.
    expect(s.drawn).toEqual(std('9', 'D'));
    dispatch({ type: 'BEGIN_SUIT_ACTION' });
    expect(s.phase.kind).toBe('awaiting-target-destroy');
    expect((s.phase as { targets: number[] }).targets).toContain(16);
    dispatch({ type: 'RESOLVE_DESTROY', slot: 16 });
    expect(s.grid[16]).toBeNull();
    expect(s.discards).toContainEqual(std('2', 'C'));

    // 7: ♠ slide — the suggested move (4♣ at 17 into the gap at 16)
    // must be legal.
    expect(s.drawn).toEqual(std('9', 'S'));
    dispatch({ type: 'BEGIN_SUIT_ACTION' });
    expect(s.phase.kind).toBe('awaiting-target-slide-source');
    expect((s.phase as { sources: number[] }).sources).toContain(17);
    dispatch({ type: 'SLIDE_SELECT_SOURCE', slot: 17 });
    expect(s.phase.kind).toBe('awaiting-target-slide-dest');
    const moves = (
      s.phase as {
        moves: { from: number; direction: unknown; distance: number; leadingDest: number }[];
      }
    ).moves;
    const intoGap = moves.find(m => m.leadingDest === 16);
    expect(intoGap, 'slide 17 → 16 must be offered').toBeDefined();
    dispatch({
      type: 'RESOLVE_SLIDE',
      from: intoGap!.from,
      direction: intoGap!.direction as never,
      distance: intoGap!.distance,
    });
    expect(s.grid[16]).toEqual(std('4', 'C'));
    expect(s.grid[17]).toBeNull();

    // 8: ♣ bonus — draw two, keep one (1 starter + 1 = hand of 2).
    expect(s.drawn).toEqual(std('9', 'C'));
    expect(s.bonusCards).toHaveLength(1);
    dispatch({ type: 'BEGIN_SUIT_ACTION' });
    expect(s.phase.kind).toBe('bonus-card-resolving');
    expect((s.phase as { drawn: unknown[] }).drawn).toHaveLength(2);
    dispatch({ type: 'BONUS_KEEP', idx: 0 });
    expect(s.bonusCards).toHaveLength(2);

    // 9: the joker auto-placed itself into the reopened slot 17 while
    // drawing — the coach's joker step is an info step about it.
    expect(s.grid[17]).toEqual({ kind: 'joker' });

    // 10: discard the 2♦.
    expect(s.drawn).toEqual(std('2', 'D'));
    dispatch({ type: 'DISCARD_NONE' });
    expect(s.discards).toContainEqual(std('2', 'D'));

    // Script exhausted: the remaining steps are the scoring recap and
    // the free-play tail, and the game is in a normal mid-run state.
    while (TUTORIAL_STEPS[stepIndex].kind === 'info') stepIndex++;
    expect(TUTORIAL_STEPS[stepIndex].kind).toBe('free');
    expect(s.phase.kind).toBe('awaiting-action');
    expect(s.drawn).not.toBeNull();
    // Enough deck to fill the whole grid (25 slots, 6 already filled
    // worth of placements made) — the tutorial always reaches a full
    // board if every remaining card is placed.
    const placed = s.grid.filter(c => c !== null).length;
    expect(s.deck.length + 1).toBeGreaterThanOrEqual(25 - placed);
  });
});
