import { Card, isJoker } from '../cards';
import { BONUS_DECK_POOL } from '../bonusCards';
import { seededRng } from '../deck';
import { LIVE_CHALLENGES, findChallenge } from '../challenges';
import { dailyTargetFor, recipeFor } from '../daily/recipe';
import { isFull } from '../grid';
import { Action, GameState, newGame, step } from '../state';
import { setupForMode } from '../../features/game/modes';

// Engine-level helper mirroring modes.ts's 'draw-poker' options (a
// fixed 3-card trio keeps the fixtures deterministic and independent
// of the pool filter, which the wiring tests cover separately).
const drawPokerGame = (seed = 7): GameState =>
  newGame('hard', seededRng(seed), {
    drawPoker: true,
    noBonusCards: true,
    targetOverride: findChallenge('draw-poker').scoreTarget,
    initialBonusCards: BONUS_DECK_POOL.slice(0, 3),
  });

// Every physical playing card the run currently owns.
const census = (s: GameState): Card[] => [
  ...s.deck,
  ...s.grid.filter((c): c is Card => c !== null),
  ...s.discards,
  ...(s.phase.kind === 'draw-select' || s.phase.kind === 'draw-place'
    ? s.phase.hand
    : []),
];

const toggle = (s: GameState, idx: number): GameState =>
  step(s, { type: 'TOGGLE_HAND_KEEP', idx });

// Stand pat: hold all five, then draw.
const standPat = (s: GameState): GameState => {
  let cur = s;
  for (let i = 0; i < 5; i++) cur = toggle(cur, i);
  return step(cur, { type: 'DRAW_REDRAW' });
};

// Stage the whole hand into `row` in dealt order and commit.
const placeRow = (s: GameState, row: number): GameState => {
  let cur = step(s, { type: 'PLACE_HAND_ROW', row });
  for (let c = 0; c < 5; c++) {
    cur = step(cur, { type: 'STAGE_HAND_CARD', idx: c, col: c });
  }
  return step(cur, { type: 'RESOLVE_PLACE_HAND' });
};

describe('Five Draw — construction', () => {
  it('starts with an empty board and hand 1 dealt into draw-select', () => {
    const s = drawPokerGame();
    expect(s.drawPoker).toBe(true);
    expect(s.grid.every(c => c === null)).toBe(true);
    expect(s.drawn).toBeNull();
    expect(s.phase.kind).toBe('draw-select');
    if (s.phase.kind !== 'draw-select') return;
    expect(s.phase.hand).toHaveLength(5);
    expect(s.phase.kept).toEqual([]);
    expect(s.phase.handNo).toBe(1);
    expect(s.deck).toHaveLength(48); // 53 (Hard: 52 + 1 joker) − 5 dealt
    expect(census(s)).toHaveLength(53);
    expect(s.bonusCards).toHaveLength(3);
    expect(s.bonusDeck).toEqual([]);
  });

  it('is deterministic from the seed', () => {
    expect(drawPokerGame(3)).toEqual(drawPokerGame(3));
  });
});

describe('Five Draw — hold toggling', () => {
  it('toggles holds on and off', () => {
    const s = drawPokerGame();
    const once = toggle(s, 2);
    expect(once.phase.kind === 'draw-select' && once.phase.kept).toEqual([2]);
    const twice = toggle(once, 2);
    expect(twice.phase.kind === 'draw-select' && twice.phase.kept).toEqual([]);
  });

  it('rejects out-of-range and wrong-phase toggles by reference', () => {
    const s = drawPokerGame();
    expect(toggle(s, 5)).toBe(s);
    expect(toggle(s, -1)).toBe(s);
    const placed = step(standPat(s), { type: 'TOGGLE_HAND_KEEP', idx: 0 });
    expect(placed.phase.kind).toBe('draw-place');
  });
});

describe('Five Draw — the redraw', () => {
  it('replaces un-held cards from the deck head, in hand order', () => {
    const s = drawPokerGame();
    if (s.phase.kind !== 'draw-select') throw new Error('bad phase');
    const before = s.phase.hand;
    const deckHead = s.deck.slice(0, 3);
    // Hold 0 and 2 — replace 1, 3, 4.
    const held = toggle(toggle(s, 0), 2);
    const after = step(held, { type: 'DRAW_REDRAW' });
    expect(after.phase.kind).toBe('draw-place');
    if (after.phase.kind !== 'draw-place') return;
    expect(after.phase.hand[0]).toBe(before[0]);
    expect(after.phase.hand[2]).toBe(before[2]);
    expect(after.phase.hand[1]).toBe(deckHead[0]);
    expect(after.phase.hand[3]).toBe(deckHead[1]);
    expect(after.phase.hand[4]).toBe(deckHead[2]);
    expect(after.deck).toHaveLength(s.deck.length - 3);
    expect(after.discards).toEqual([before[1], before[3], before[4]]);
    expect(after.phase.row).toBeNull();
    expect(after.phase.placed).toEqual([null, null, null, null, null]);
  });

  it('standing pat consumes nothing', () => {
    const s = drawPokerGame();
    const after = standPat(s);
    expect(after.phase.kind).toBe('draw-place');
    if (after.phase.kind !== 'draw-place' || s.phase.kind !== 'draw-select')
      return;
    expect(after.phase.hand).toEqual(s.phase.hand);
    expect(after.deck).toEqual(s.deck);
    expect(after.discards).toEqual([]);
  });

  it('there is no second redraw', () => {
    const placed = standPat(drawPokerGame());
    expect(step(placed, { type: 'DRAW_REDRAW' })).toBe(placed);
  });
});

describe('Five Draw — row placement', () => {
  it('stages, validates, seats, and deals the next hand', () => {
    const s = standPat(drawPokerGame());
    if (s.phase.kind !== 'draw-place') throw new Error('bad phase');
    const hand = s.phase.hand;
    const deckBefore = s.deck;

    let cur = step(s, { type: 'PLACE_HAND_ROW', row: 2 });
    expect(cur.phase.kind === 'draw-place' && cur.phase.row).toBe(2);

    // Early commit rejected until all five are staged.
    expect(step(cur, { type: 'RESOLVE_PLACE_HAND' })).toBe(cur);

    // Stage hand[3] at column 0, then reject a duplicate / occupied col.
    cur = step(cur, { type: 'STAGE_HAND_CARD', idx: 3, col: 0 });
    expect(step(cur, { type: 'STAGE_HAND_CARD', idx: 3, col: 1 })).toBe(cur);
    expect(step(cur, { type: 'STAGE_HAND_CARD', idx: 0, col: 0 })).toBe(cur);

    // Unstage returns it to the hand.
    const unstaged = step(cur, { type: 'UNSTAGE_HAND_CARD', col: 0 });
    expect(
      unstaged.phase.kind === 'draw-place' && unstaged.phase.placed[0]
    ).toBeNull();

    // Reverse dealt order: hand[4-c] at column c.
    cur = unstaged;
    for (let c = 0; c < 5; c++) {
      cur = step(cur, { type: 'STAGE_HAND_CARD', idx: 4 - c, col: c });
    }
    const done = step(cur, { type: 'RESOLVE_PLACE_HAND' });
    for (let c = 0; c < 5; c++) {
      expect(done.grid[2 * 5 + c]).toEqual(hand[4 - c]);
    }
    expect(done.phase.kind).toBe('draw-select');
    if (done.phase.kind !== 'draw-select') return;
    expect(done.phase.handNo).toBe(2);
    expect(done.phase.hand).toEqual(deckBefore.slice(0, 5));
    expect(done.deck).toEqual(deckBefore.slice(5));
  });

  it('row switching keeps the staging; occupied rows are rejected', () => {
    const s = standPat(drawPokerGame());
    let cur = step(s, { type: 'PLACE_HAND_ROW', row: 1 });
    cur = step(cur, { type: 'STAGE_HAND_CARD', idx: 0, col: 3 });
    const switched = step(cur, { type: 'PLACE_HAND_ROW', row: 4 });
    expect(switched.phase.kind === 'draw-place' && switched.phase.row).toBe(4);
    expect(
      switched.phase.kind === 'draw-place' && switched.phase.placed[3]
    ).toBe(0);

    // Commit row 4, then row 4 is no longer selectable for hand 2.
    let filled = switched;
    for (let c = 0; c < 5; c++) {
      if (
        filled.phase.kind === 'draw-place' &&
        filled.phase.placed[c] === null
      ) {
        const stagedSet = new Set(
          filled.phase.placed.filter(p => p !== null)
        );
        const idx = [0, 1, 2, 3, 4].find(i => !stagedSet.has(i))!;
        filled = step(filled, { type: 'STAGE_HAND_CARD', idx, col: c });
      }
    }
    const next = step(filled, { type: 'RESOLVE_PLACE_HAND' });
    const hand2 = standPat(next);
    expect(step(hand2, { type: 'PLACE_HAND_ROW', row: 4 })).toBe(hand2);
  });

  it('CANCEL clears the staging without touching the grid', () => {
    const s = standPat(drawPokerGame());
    let cur = step(s, { type: 'PLACE_HAND_ROW', row: 0 });
    cur = step(cur, { type: 'STAGE_HAND_CARD', idx: 1, col: 1 });
    const cleared = step(cur, { type: 'CANCEL_ACTION' });
    expect(cleared.phase.kind === 'draw-place' && cleared.phase.row).toBeNull();
    expect(
      cleared.phase.kind === 'draw-place' &&
        cleared.phase.placed.every(p => p === null)
    ).toBe(true);
    // A second cancel with nothing staged is a no-op.
    expect(step(cleared, { type: 'CANCEL_ACTION' })).toBe(cleared);
  });
});

describe('Five Draw — full game', () => {
  const playOut = (redrawAll: boolean): GameState => {
    let s = drawPokerGame(11);
    for (let row = 0; row < 5; row++) {
      s = redrawAll ? step(s, { type: 'DRAW_REDRAW' }) : standPat(s);
      s = placeRow(s, row);
    }
    return s;
  };

  it('ends at game-over with a full board after hand 5', () => {
    const s = playOut(false);
    expect(s.phase.kind).toBe('game-over');
    expect(isFull(s.grid)).toBe(true);
    expect(s.drawn).toBeNull();
  });

  it('never runs the deck dry even redrawing all five every hand', () => {
    const s = playOut(true);
    expect(s.phase.kind).toBe('game-over');
    // 53 − 25 placed − 25 redrawn = 3 left.
    expect(s.deck).toHaveLength(3);
    expect(s.discards).toHaveLength(25);
  });
});

describe('Five Draw — undo', () => {
  it('undo after placing a row restores the fully-staged draw-place', () => {
    let s = standPat(drawPokerGame());
    s = step(s, { type: 'PLACE_HAND_ROW', row: 0 });
    for (let c = 0; c < 5; c++) {
      s = step(s, { type: 'STAGE_HAND_CARD', idx: c, col: c });
    }
    const committed = step(s, { type: 'RESOLVE_PLACE_HAND' });
    expect(committed.phase.kind).toBe('draw-select');
    const undone = step(committed, { type: 'UNDO' });
    expect(undone.phase.kind).toBe('draw-place');
    if (undone.phase.kind !== 'draw-place') return;
    expect(undone.phase.row).toBe(0);
    expect(undone.phase.placed).toEqual([0, 1, 2, 3, 4]);
    expect(undone.grid.every(c => c === null)).toBe(true);
    expect(undone.deck).toEqual(s.deck);
    expect(undone.rngState).toBe(s.rngState);
    // Redo replays identically (mod bookkeeping).
    const redone = step(undone, { type: 'RESOLVE_PLACE_HAND' });
    expect({ ...redone, past: [], undoCount: 0 }).toEqual({
      ...committed,
      past: [],
      undoCount: 0,
    });
  });

  it('undo after the redraw restores the pre-redraw hand and deck', () => {
    const s = drawPokerGame();
    if (s.phase.kind !== 'draw-select') throw new Error('bad phase');
    const held = toggle(s, 0);
    const redrawn = step(held, { type: 'DRAW_REDRAW' });
    const undone = step(redrawn, { type: 'UNDO' });
    expect(undone.phase.kind).toBe('draw-select');
    if (undone.phase.kind !== 'draw-select') return;
    expect(undone.phase.hand).toEqual(s.phase.hand);
    expect(undone.deck).toEqual(held.deck);
    expect(undone.discards).toEqual([]);
  });
});

describe('Five Draw — the old loop stays sealed off', () => {
  it('rejects every drawn-card action from both phases, without rng drift', () => {
    const select = drawPokerGame();
    const place = standPat(select);
    const rejected: Action[] = [
      { type: 'PLACE' },
      { type: 'DISCARD_NONE' },
      { type: 'BEGIN_SUIT_ACTION' },
      { type: 'FLIP_CARD' },
      { type: 'RESOLVE_HOP', i: 0, j: 1 },
      { type: 'RESOLVE_DESTROY', slot: 0 },
      { type: 'ACTIVATE_SPECIAL_CARD', idx: 0 },
    ];
    for (const a of rejected) {
      expect(step(select, a)).toBe(select);
      expect(step(place, a)).toBe(place);
    }
    expect(step(select, { type: 'CANCEL_ACTION' })).toBe(select);
  });

  it('step is re-invocation safe (purity)', () => {
    const s = drawPokerGame();
    const a: Action = { type: 'DRAW_REDRAW' };
    expect(step(s, a)).toEqual(step(s, a));
  });
});

describe('Five Draw — wiring and catalog', () => {
  it('setupForMode wires the challenge route', () => {
    const setup = setupForMode({ kind: 'challenge', id: 'draw-poker' });
    expect(setup.target).toBe(500);
    const s = setup.start(seededRng(5));
    expect(s.drawPoker).toBe(true);
    expect(s.noBonusCards).toBe(true);
    expect(s.bonusCards).toHaveLength(3);
    // The starter pool filter: none of the broken-here cards deal in.
    const banned = new Set([
      'spotlight-x1_5',
      'burnout-x1_25',
      'frugal-x1_5',
      'patience-no-penalty',
    ]);
    for (const c of s.bonusCards) expect(banned.has(c.id)).toBe(false);
    expect(census(s)).toHaveLength(53); // jokers stay in the deck
  });

  it('daily recipes deal jokers at the difficulty count', () => {
    const easy = setupForMode({
      kind: 'daily',
      dateISO: '2026-07-01',
      recipe: { difficulty: 'easy', twist: 'draw-poker' },
    }).start(seededRng(5));
    expect(easy.drawPoker).toBe(true);
    const easyCards = census(easy);
    expect(easyCards).toHaveLength(54); // 52 + Easy's 2 jokers
    const jokers = easyCards.filter(isJoker).length;
    expect(jokers).toBe(2);

    const hard = setupForMode({
      kind: 'daily',
      dateISO: '2026-07-01',
      recipe: { difficulty: 'hard', twist: 'draw-poker' },
    }).start(seededRng(5));
    expect(census(hard)).toHaveLength(53);
  });

  it('is the last live entry, at the Hard base target, out of the rotation', () => {
    const c = LIVE_CHALLENGES[LIVE_CHALLENGES.length - 1];
    expect(c.id).toBe('draw-poker');
    expect(c.name).toBe('Five Draw');
    expect(c.scoreTarget).toBe(500);
    expect(c.goal.startsWith('Score 500+ points')).toBe(true);
    expect(dailyTargetFor('hard', 'draw-poker')).toBe(500);
    for (let i = 0; i < 366; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      expect(recipeFor(iso).twist).not.toBe('draw-poker');
    }
  });
});
