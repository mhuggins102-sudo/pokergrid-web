import { Card, Rank, StandardCard, Suit, isJoker } from '../cards';
import {
  ALL_ROWS_CARD,
  ALL_ROWS_ID,
  BONUS_DECK_POOL,
  hydrateBonusCard,
} from '../bonusCards';
import { seededRng } from '../deck';
import { LIVE_CHALLENGES, findChallenge } from '../challenges';
import { dailyTargetFor, recipeFor } from '../daily/recipe';
import { emptyGrid, isFull } from '../grid';
import { scoreGrid } from '../scoring';
import { Action, GameState, newGame, step } from '../state';
import { setupForMode } from '../../features/game/modes';
import { categoryOf } from '../../lib/bonusCardCategory';

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
    expect(s.phase.draws).toBe(0);
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
  it('first draw replaces from the deck head and opens round two', () => {
    const s = drawPokerGame();
    if (s.phase.kind !== 'draw-select') throw new Error('bad phase');
    const before = s.phase.hand;
    const deckHead = s.deck.slice(0, 3);
    // Hold 0 and 2 — replace 1, 3, 4.
    const held = toggle(toggle(s, 0), 2);
    const after = step(held, { type: 'DRAW_REDRAW' });
    expect(after.phase.kind).toBe('draw-select');
    if (after.phase.kind !== 'draw-select') return;
    expect(after.phase.draws).toBe(1);
    expect(after.phase.kept).toEqual([]); // holds reset — fresh choice
    expect(after.phase.hand[0]).toBe(before[0]);
    expect(after.phase.hand[2]).toBe(before[2]);
    expect(after.phase.hand[1]).toBe(deckHead[0]);
    expect(after.phase.hand[3]).toBe(deckHead[1]);
    expect(after.phase.hand[4]).toBe(deckHead[2]);
    expect(after.deck).toHaveLength(s.deck.length - 3);
    expect(after.discards).toEqual([before[1], before[3], before[4]]);
  });

  it('the second draw heads to placement; a third is impossible', () => {
    const roundTwo = step(
      step(drawPokerGame(), { type: 'DRAW_REDRAW' }),
      { type: 'TOGGLE_HAND_KEEP', idx: 0 }
    );
    if (roundTwo.phase.kind !== 'draw-select') throw new Error('bad phase');
    const deckHead = roundTwo.deck.slice(0, 4);
    const after = step(roundTwo, { type: 'DRAW_REDRAW' });
    expect(after.phase.kind).toBe('draw-place');
    if (after.phase.kind !== 'draw-place') return;
    expect(after.phase.row).toBeNull();
    expect(after.phase.placed).toEqual([null, null, null, null, null]);
    expect(after.phase.hand.slice(1)).toEqual(deckHead);
    expect(step(after, { type: 'DRAW_REDRAW' })).toBe(after);
  });

  it('round two allows a full five-card redraw', () => {
    const roundTwo = step(drawPokerGame(), { type: 'DRAW_REDRAW' });
    expect(roundTwo.phase.kind).toBe('draw-select');
    const after = step(roundTwo, { type: 'DRAW_REDRAW' }); // kept []
    expect(after.phase.kind).toBe('draw-place');
    expect(after.deck).toHaveLength(roundTwo.deck.length - 5);
  });

  it('round two can place directly; round one cannot', () => {
    const fresh = drawPokerGame();
    expect(step(fresh, { type: 'PLACE_HAND_ROW', row: 1 })).toBe(fresh);
    const roundTwo = step(fresh, { type: 'DRAW_REDRAW' });
    if (roundTwo.phase.kind !== 'draw-select') throw new Error('bad phase');
    const hand = roundTwo.phase.hand;
    const placed = step(roundTwo, { type: 'PLACE_HAND_ROW', row: 1 });
    expect(placed.phase.kind).toBe('draw-place');
    if (placed.phase.kind !== 'draw-place') return;
    expect(placed.phase.row).toBe(1);
    expect(placed.phase.hand).toEqual(hand);
    expect(placed.deck).toEqual(roundTwo.deck); // no cards moved
  });

  it('standing pat consumes nothing and skips straight to placement', () => {
    const s = drawPokerGame();
    const after = standPat(s);
    expect(after.phase.kind).toBe('draw-place');
    if (after.phase.kind !== 'draw-place' || s.phase.kind !== 'draw-select')
      return;
    expect(after.phase.hand).toEqual(s.phase.hand);
    expect(after.deck).toEqual(s.deck);
    expect(after.discards).toEqual([]);
  });

  it('no redraw from the placement phase', () => {
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

  it('the fifth hand opens with the last empty row pre-selected', () => {
    let s = drawPokerGame(11);
    for (let row = 0; row < 4; row++) {
      s = placeRow(standPat(s), row);
    }
    // Hands 1-4 open with the row unpicked (covered above); the fifth
    // has exactly one empty row left, so picking it is skipped.
    const last = standPat(s);
    expect(last.phase.kind === 'draw-place' && last.phase.row).toBe(4);
    expect(
      last.phase.kind === 'draw-place' &&
        last.phase.placed.every(p => p === null)
    ).toBe(true);
  });

  it('Back returns placement to the hold state while a draw remains', () => {
    // Stand pat round 1 → placement with both draws still unspent.
    const s = standPat(drawPokerGame());
    let cur = step(s, { type: 'PLACE_HAND_ROW', row: 0 });
    cur = step(cur, { type: 'STAGE_HAND_CARD', idx: 1, col: 1 });
    if (cur.phase.kind !== 'draw-place') throw new Error('bad phase');
    const hand = cur.phase.hand;
    const back = step(cur, { type: 'CANCEL_ACTION' });
    expect(back.phase.kind).toBe('draw-select');
    if (back.phase.kind !== 'draw-select') return;
    expect(back.phase.hand).toEqual(hand); // staging dissolved, hand intact
    expect(back.phase.kept).toEqual([]);
    expect(back.phase.draws).toBe(0); // stand pat spent nothing
    expect(back.grid).toEqual(cur.grid);
    expect(back.deck).toEqual(cur.deck);
  });

  it('after the second draw, CANCEL only clears the staging', () => {
    // Draw twice — no draw left, so no Back to a hold state.
    let s = step(drawPokerGame(), { type: 'DRAW_REDRAW' });
    s = step(s, { type: 'TOGGLE_HAND_KEEP', idx: 0 });
    s = step(s, { type: 'DRAW_REDRAW' });
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

  it('one full redraw per hand leaves the deck at 3', () => {
    const s = playOut(true);
    expect(s.phase.kind).toBe('game-over');
    // 53 − 25 placed − 25 redrawn = 3 left. (Second draws can burn
    // further — the depletion suite below covers running dry.)
    expect(s.deck).toHaveLength(3);
    expect(s.discards).toHaveLength(25);
  });
});

describe('Five Draw — deck depletion', () => {
  // Maximum burn for one hand: draw all five, hold one, draw the
  // other four again — 14 cards counting the deal.
  const burnHand = (s: GameState): GameState => {
    let cur = step(s, { type: 'DRAW_REDRAW' });
    cur = step(cur, { type: 'TOGGLE_HAND_KEEP', idx: 0 });
    return step(cur, { type: 'DRAW_REDRAW' });
  };

  // Three burned hands: deck 48 → 39 → 34 (deal) → 25 → 20 → 11 → 6.
  const afterThreeBurns = (): GameState => {
    let s = drawPokerGame(11);
    for (let row = 0; row < 3; row++) {
      s = placeRow(burnHand(s), row);
    }
    return s;
  };

  it('a draw that empties the deck heads straight to placement', () => {
    const s = afterThreeBurns();
    expect(s.deck).toHaveLength(6);
    let h4 = step(s, { type: 'DRAW_REDRAW' }); // 5 drawn, deck 1
    for (const i of [0, 1, 2, 3]) {
      h4 = step(h4, { type: 'TOGGLE_HAND_KEEP', idx: i });
    }
    h4 = step(h4, { type: 'DRAW_REDRAW' }); // last card — deck dry
    expect(h4.deck).toHaveLength(0);
    expect(h4.phase.kind).toBe('draw-place');

    // No card left to deal hand 5: the game ends with row 5 empty.
    const over = placeRow(h4, 3);
    expect(over.phase.kind).toBe('game-over');
    expect(over.grid.filter(c => c !== null)).toHaveLength(20);
    expect(isFull(over.grid)).toBe(false);
  });

  it('deals a short final hand and commits it once fully staged', () => {
    const s = afterThreeBurns();
    let h4 = step(s, { type: 'DRAW_REDRAW' }); // deck 1
    expect(h4.deck).toHaveLength(1);
    if (h4.phase.kind !== 'draw-select') throw new Error('bad phase');
    expect(h4.phase.draws).toBe(1);
    h4 = step(h4, { type: 'PLACE_HAND_ROW', row: 3 }); // place as-is
    const afterH4 = placeRow(h4, 3);

    // One card was left: hand 5 is a single card, the deck is dry, so
    // the hold step is skipped — placement opens with the last row
    // pre-selected.
    expect(afterH4.phase.kind).toBe('draw-place');
    if (afterH4.phase.kind !== 'draw-place') return;
    expect(afterH4.phase.hand).toHaveLength(1);
    expect(afterH4.phase.row).toBe(4);
    expect(afterH4.deck).toHaveLength(0);

    // Committing needs every HAND card staged (one), not five; the
    // row's other columns stay empty and the game ends.
    expect(step(afterH4, { type: 'RESOLVE_PLACE_HAND' })).toBe(afterH4);
    const staged = step(afterH4, {
      type: 'STAGE_HAND_CARD',
      idx: 0,
      col: 2,
    });
    const over = step(staged, { type: 'RESOLVE_PLACE_HAND' });
    expect(over.phase.kind).toBe('game-over');
    expect(over.grid.filter(c => c !== null)).toHaveLength(21);
    expect(over.grid[4 * 5 + 2]).not.toBeNull();
  });
});

describe('Five Draw — the bonus offer', () => {
  // The plain helper passes no offer deck, so every earlier suite
  // runs the direct hand-to-hand flow; this one opts in.
  const withOffers = (seed = 7): GameState =>
    newGame('hard', seededRng(seed), {
      drawPoker: true,
      noBonusCards: true,
      targetOverride: findChallenge('draw-poker').scoreTarget,
      initialBonusCards: BONUS_DECK_POOL.slice(0, 3),
      initialBonusDeck: BONUS_DECK_POOL.slice(3, 8),
    });

  const placeFirstRow = (s: GameState): GameState => placeRow(standPat(s), 0);

  it('offers one card after the row commits — next hand not yet dealt', () => {
    const after = placeFirstRow(withOffers());
    expect(after.phase.kind).toBe('draw-bonus');
    if (after.phase.kind !== 'draw-bonus') return;
    expect(after.phase.offer.id).toBe(BONUS_DECK_POOL[3].id);
    expect(after.phase.handNo).toBe(1);
    expect(after.bonusDeck.map(c => c.id)).toEqual(
      BONUS_DECK_POOL.slice(4, 8).map(c => c.id)
    );
    expect(after.deck).toHaveLength(48); // deal waits for the decision
  });

  it('pass lets the offer go and deals the next hand', () => {
    const offered = placeFirstRow(withOffers());
    const heldIds = offered.bonusCards.map(c => c.id);
    const after = step(offered, { type: 'PASS_BONUS_CARD' });
    expect(after.phase.kind).toBe('draw-select');
    if (after.phase.kind !== 'draw-select') return;
    expect(after.phase.handNo).toBe(2);
    expect(after.phase.draws).toBe(0);
    expect(after.deck).toHaveLength(43);
    expect(after.bonusCards.map(c => c.id)).toEqual(heldIds);
  });

  it('keep swaps the offer over the chosen held card, then deals', () => {
    const offered = placeFirstRow(withOffers());
    if (offered.phase.kind !== 'draw-bonus') throw new Error('bad phase');
    const offer = offered.phase.offer;
    const held = offered.bonusCards;
    const after = step(offered, { type: 'KEEP_BONUS_CARD', slot: 1 });
    expect(after.bonusCards[0]).toBe(held[0]);
    expect(after.bonusCards[1]).toBe(offer);
    expect(after.bonusCards[2]).toBe(held[2]);
    expect(after.phase.kind).toBe('draw-select');
    expect(after.deck).toHaveLength(43);
  });

  it('rejects bad slots and wrong phases by reference', () => {
    const offered = placeFirstRow(withOffers());
    expect(step(offered, { type: 'KEEP_BONUS_CARD', slot: 3 })).toBe(offered);
    expect(step(offered, { type: 'KEEP_BONUS_CARD', slot: -1 })).toBe(offered);
    expect(step(offered, { type: 'DRAW_REDRAW' })).toBe(offered);
    expect(step(offered, { type: 'CANCEL_ACTION' })).toBe(offered);
    const select = withOffers();
    expect(step(select, { type: 'PASS_BONUS_CARD' })).toBe(select);
    expect(step(select, { type: 'KEEP_BONUS_CARD', slot: 0 })).toBe(select);
  });

  it('hands 1-4 each offer; hand 5 ends the game with no offer', () => {
    let s = withOffers(11);
    let offers = 0;
    for (let row = 0; row < 5; row++) {
      s = placeRow(standPat(s), row);
      if (s.phase.kind === 'draw-bonus') {
        offers++;
        s = step(s, { type: 'PASS_BONUS_CARD' });
      }
    }
    expect(offers).toBe(4);
    expect(s.phase.kind).toBe('game-over');
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
    // No undos in this mode (the tutorial precedent) — canUndo stays
    // false for the whole run.
    expect(setup.maxUndos).toBe(0);
    const s = setup.start(seededRng(5));
    expect(s.drawPoker).toBe(true);
    expect(s.noBonusCards).toBe(true);
    expect(s.bonusCards).toHaveLength(3);
    // The exclusive All Rows ×3 always leads the trio.
    expect(s.bonusCards[0].id).toBe(ALL_ROWS_ID);
    // The starter pool filter: none of the broken-here cards deal in.
    const banned = new Set([
      'spotlight-x1_5',
      'burnout-x1_25',
      'frugal-x1_5',
      'patience-no-penalty',
    ]);
    for (const c of s.bonusCards) expect(banned.has(c.id)).toBe(false);
    // The offer deck is the filtered pool minus the 2 dealt starters
    // (4 ids excluded; All Rows lives outside the pool) — one card is
    // offered after each of hands 1-4.
    expect(s.bonusDeck.length).toBe(BONUS_DECK_POOL.length - 6);
    const heldIds = new Set(s.bonusCards.map(c => c.id));
    for (const c of s.bonusDeck) {
      expect(banned.has(c.id)).toBe(false);
      expect(heldIds.has(c.id)).toBe(false);
    }
    expect(census(s)).toHaveLength(53); // jokers stay in the deck
  });

  it('daily recipes deal jokers at the difficulty count', () => {
    const easySetup = setupForMode({
      kind: 'daily',
      dateISO: '2026-07-01',
      recipe: { difficulty: 'easy', twist: 'draw-poker' },
    });
    expect(easySetup.maxUndos).toBe(0); // no undos on the daily either
    const easy = easySetup.start(seededRng(5));
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

    // Dailies deal the same fixed-first trio AND offer deck, seeded
    // off the date: identical for everyone on the day regardless of
    // the deck rng.
    expect(easy.bonusCards[0].id).toBe(ALL_ROWS_ID);
    expect(easy.bonusCards.map(c => c.id)).toEqual(
      hard.bonusCards.map(c => c.id)
    );
    expect(easy.bonusDeck.map(c => c.id)).toEqual(
      hard.bonusDeck.map(c => c.id)
    );
  });

  it('sits directly above Nut Low, in the rotation at base targets', () => {
    const idx = LIVE_CHALLENGES.findIndex(ch => ch.id === 'draw-poker');
    expect(idx).toBeGreaterThan(-1);
    expect(LIVE_CHALLENGES[idx + 1]?.id).toBe('nut-low');
    const c = LIVE_CHALLENGES[idx];
    expect(c.name).toBe('Five Draw');
    expect(c.scoreTarget).toBe(500);
    expect(c.goal.startsWith('Score 500+ points')).toBe(true);
    // Daily targets follow the difficulty base (no fixed override).
    expect(dailyTargetFor('hard', 'draw-poker')).toBe(500);
    expect(dailyTargetFor('medium', 'draw-poker')).toBe(450);
    expect(dailyTargetFor('easy', 'draw-poker')).toBe(400);
    // In the rotation now: the timeTrial.test pattern — sweep until a
    // day rolls it (deterministic recipe, so this is a fixed fact).
    let hit: string | null = null;
    for (let i = 0; i < 3650 && hit === null; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      if (recipeFor(iso).twist === 'draw-poker') hit = iso;
    }
    expect(hit).not.toBeNull();
  });
});

describe('Five Draw — All Rows ×3', () => {
  const C = (rank: Rank, suit: Suit): StandardCard => ({
    kind: 'standard',
    rank,
    suit,
  });

  it('multiplies every scoring row ×3 and no column', () => {
    // Outer Edge test template: two pair rows on an otherwise empty
    // grid, so their line scores are directly comparable.
    const g = emptyGrid();
    const r0 = [C('2', 'H'), C('2', 'C'), C('5', 'D'), C('8', 'S'), C('K', 'H')];
    const r2 = [C('3', 'H'), C('3', 'C'), C('6', 'D'), C('9', 'S'), C('Q', 'H')];
    for (let i = 0; i < 5; i++) g[i] = r0[i];
    for (let i = 0; i < 5; i++) g[10 + i] = r2[i];
    const report = scoreGrid(g, [ALL_ROWS_CARD]);
    for (const idx of [0, 2]) {
      const row = report.lines.find(l => l.kind === 'row' && l.index === idx)!;
      expect(row.multiplier).toBe(3);
    }
    // Columns are single cards (incomplete) here — fill col 0 to prove
    // a COMPLETE column still gets no multiplier.
    for (let r = 0; r < 5; r++) g[r * 5] ??= C('4', 'D');
    for (let i = 0; i < 25; i++) g[i] ??= C('J', 'C');
    const full = scoreGrid(g, [ALL_ROWS_CARD]);
    for (const line of full.lines) {
      expect(line.multiplier).toBe(line.kind === 'row' ? 3 : 1);
    }
  });

  it('is a gold line card that survives a save roundtrip', () => {
    expect(categoryOf(ALL_ROWS_CARD)).toBe('line');
    expect(ALL_ROWS_CARD.emblem).toBe('★');
    // Daily plays JSON-roundtrip held cards; hydration must find the
    // challenge pool or the card would render but score 0 on re-entry.
    const revived = hydrateBonusCard(
      JSON.parse(JSON.stringify(ALL_ROWS_CARD)) as typeof ALL_ROWS_CARD
    );
    expect(revived.lineEffect).toBeDefined();
    const g = emptyGrid();
    const r0 = [C('2', 'H'), C('2', 'C'), C('5', 'D'), C('8', 'S'), C('K', 'H')];
    for (let i = 0; i < 5; i++) g[i] = r0[i];
    const row0 = scoreGrid(g, [revived]).lines.find(
      l => l.kind === 'row' && l.index === 0
    )!;
    expect(row0.multiplier).toBe(3);
  });
});
