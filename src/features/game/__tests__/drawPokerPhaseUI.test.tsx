import { render } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PhaseUI, usePhaseUI } from '../usePhaseUI';
import { Card, Rank, Suit } from '../../../game/cards';

/*
 * Five Draw's two phases through the usePhaseUI lens. The contracts
 * that matter:
 *  - BOTH phases banner (the mode has no undos to keep reachable), so
 *    the dock renders the same banner + HandWell + commit stack in
 *    every step and never changes size.
 *  - draw-select offers exactly one action ('draw'); the HandWell
 *    toggles holds.
 *  - draw-place, row unpicked: ONLY the first slot of each open row
 *    offers. Row picked: exactly that row's five slots light up
 *    (staged = selected, open = target); another open row's FIRST
 *    slot still answers a tap — unhighlighted — to switch rows.
 *    Staged cards come back by tapping them; while a draw remains a
 *    Back action returns to the hold state. 'place-hand' arms once
 *    every hand card is staged.
 *  - Neither phase offers Discard or special activation.
 */

const dispatch = vi.fn();
let mockState: Record<string, unknown> = {};
vi.mock('../GameSessionProvider', () => ({
  useGameSession: () => ({ state: mockState, dispatch }),
}));

let ui: PhaseUI;
function Probe() {
  ui = usePhaseUI();
  return null;
}

const probe = (state: Record<string, unknown>) => {
  mockState = state;
  render(<Probe />).unmount();
};

const c = (rank: Rank, suit: Suit): Card => ({ kind: 'standard', rank, suit });
const HAND: Card[] = [c('2', 'H'), c('7', 'S'), c('7', 'D'), c('K', 'C'), c('A', 'H')];

const emptyGrid = () => Array<Card | null>(25).fill(null);

const baseState = (phase: Record<string, unknown>) => ({
  grid: emptyGrid(),
  randomPerks: false,
  drawn: null,
  deck: Array<Card>(40).fill(c('2', 'C')),
  phase,
});

beforeEach(() => dispatch.mockClear());

describe('draw-select', () => {
  test('round one: hold prompt, exactly the draw action, no cells', () => {
    probe(
      baseState({
        kind: 'draw-select',
        hand: HAND,
        kept: [1, 2],
        handNo: 1,
        draws: 0,
      })
    );
    expect(ui.banner).toBe('Select cards to hold');
    expect(ui.actions.map(a => a.id)).toEqual(['draw']);
    expect(ui.actions[0].label).toBe('Draw 3');
    expect(ui.actions[0].disabled).toBe(false);
    expect(ui.canActivateSpecials).toBe(false);
    for (let i = 0; i < 25; i++) expect(ui.isTappable(i)).toBe(false);
  });

  test('holding all five relabels the action Stand pat', () => {
    probe(
      baseState({
        kind: 'draw-select',
        hand: HAND,
        kept: [0, 1, 2, 3, 4],
        handNo: 3,
        draws: 0,
      })
    );
    expect(ui.actions[0].label).toBe('Stand pat');
  });

  test('hand is keep-mode; card taps toggle holds', () => {
    probe(
      baseState({
        kind: 'draw-select',
        hand: HAND,
        kept: [1],
        handNo: 1,
        draws: 0,
      })
    );
    const hand = ui.hand!;
    expect(hand.mode).toBe('keep');
    expect([...hand.marked]).toEqual([1]);
    expect(hand.orderOf(1)).toBeNull();
    expect(hand.tappable(4)).toBe(true);
    hand.onCardTap(4);
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_HAND_KEEP', idx: 4 });
  });

  test('round two: place-or-hold banner, row starts offer, Draw armed', () => {
    // Row 0 seated by hand 1 — rows 1-4 open.
    const grid = emptyGrid();
    for (let i = 0; i < 5; i++) grid[i] = c('3', 'S');
    probe({
      ...baseState({
        kind: 'draw-select',
        hand: HAND,
        kept: [],
        handNo: 2,
        draws: 1,
      }),
      grid,
    });
    expect(ui.banner).toBe('Select placement row or cards to hold');
    // A full five-card redraw is allowed in round two — Draw only
    // disables when the deck can't serve it.
    expect(ui.actions[0].label).toBe('Draw 5');
    expect(ui.actions[0].disabled).toBe(false);
    expect(ui.isTappable(0)).toBe(false); // filled row
    expect(ui.isTappable(5)).toBe(true); // open row's first slot
    expect(ui.roleOf(5)).toBe('target');
    expect(ui.isTappable(7)).toBe(false);
    ui.onCellTap(5);
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLACE_HAND_ROW', row: 1 });
  });

  test('a deck too small for the request disables Draw', () => {
    const phase = {
      kind: 'draw-select',
      hand: HAND,
      kept: [0, 1],
      handNo: 2,
      draws: 1,
    };
    probe(baseState(phase));
    expect(ui.actions[0].label).toBe('Draw 3');
    expect(ui.actions[0].disabled).toBe(false);
    // Deck can't cover the request (2 left, 3 wanted) — hold more.
    probe({ ...baseState(phase), deck: [c('4', 'D'), c('5', 'D')] });
    expect(ui.actions[0].disabled).toBe(true);
  });
});

describe('draw-place', () => {
  // draws: 2 — both draws spent, so no Back action muddies the
  // baseline assertions; the Back tests below use draws: 1.
  const rowNullPhase = {
    kind: 'draw-place',
    hand: HAND,
    row: null,
    placed: [null, null, null, null, null],
    handNo: 2,
    draws: 2,
  };

  test('row unpicked: only the FIRST slot of each open row offers', () => {
    // Row 0 already seated (a previous hand) — its cells must not offer.
    const grid = emptyGrid();
    for (let i = 0; i < 5; i++) grid[i] = c('3', 'S');
    probe({ ...baseState(rowNullPhase), grid });
    expect(ui.banner).toBe('Select placement row');
    expect(ui.actions.map(a => a.id)).toEqual(['place-hand']); // no Cancel
    expect(ui.actions[0].disabled).toBe(true);
    expect(ui.isTappable(0)).toBe(false); // filled row 0's first slot
    expect(ui.isTappable(5)).toBe(true); // empty row 1's first slot
    expect(ui.roleOf(5)).toBe('target');
    expect(ui.isTappable(7)).toBe(false); // rest of the row stays dark
    expect(ui.roleOf(7)).toBeNull();
    ui.onCellTap(5);
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLACE_HAND_ROW', row: 1 });
    dispatch.mockClear();
    // A non-first cell of an open row does nothing.
    ui.onCellTap(7);
    expect(dispatch).not.toHaveBeenCalled();
    // Hand cards are inert until a row is chosen.
    expect(ui.hand!.tappable(0)).toBe(false);
  });

  const rowPickedPhase = {
    ...rowNullPhase,
    row: 2,
    placed: [3, null, null, null, null],
  };

  test('row picked: only that row lights up — staged unstage, open stage', () => {
    probe(baseState(rowPickedPhase));
    expect(ui.banner).toBe('Select cards in placement order');
    expect(ui.roleOf(10)).toBe('selected'); // row 2 col 0 — staged
    ui.onCellTap(10);
    expect(dispatch).toHaveBeenCalledWith({ type: 'UNSTAGE_HAND_CARD', col: 0 });
    dispatch.mockClear();
    expect(ui.roleOf(11)).toBe('target'); // row 2 col 1 — open
    expect(ui.isTappable(14)).toBe(true); // all five row-2 slots offer
    ui.onCellTap(11);
    // Lowest unstaged hand index is 0 (only idx 3 is staged).
    expect(dispatch).toHaveBeenCalledWith({
      type: 'STAGE_HAND_CARD',
      idx: 0,
      col: 1,
    });
    dispatch.mockClear();
    // Another open row's FIRST slot switches rows — quietly (no
    // highlight); its other slots stay fully inert.
    expect(ui.isTappable(20)).toBe(true); // row 4 col 0
    expect(ui.roleOf(20)).toBeNull();
    ui.onCellTap(20);
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLACE_HAND_ROW', row: 4 });
    dispatch.mockClear();
    expect(ui.isTappable(21)).toBe(false);
    ui.onCellTap(21);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('hand is place-mode: taps stage at leftmost open / take back', () => {
    probe(baseState(rowPickedPhase));
    const hand = ui.hand!;
    expect(hand.mode).toBe('place');
    expect(hand.orderOf(3)).toBe(0); // seated at col 0
    expect(hand.orderOf(1)).toBeNull();
    hand.onCardTap(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'STAGE_HAND_CARD',
      idx: 1,
      col: 1, // leftmost open column
    });
    dispatch.mockClear();
    hand.onCardTap(3); // staged — tap takes it back
    expect(dispatch).toHaveBeenCalledWith({ type: 'UNSTAGE_HAND_CARD', col: 0 });
  });

  test('place-hand arms with all five staged, banner points at it', () => {
    probe(baseState({ ...rowPickedPhase, placed: [3, 0, 1, 2, 4] }));
    expect(ui.banner).toBe('Use Place Hand to finalize');
    const place = ui.actions.find(a => a.id === 'place-hand')!;
    expect(place.disabled).toBe(false);
    place.onPress();
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESOLVE_PLACE_HAND' });
  });

  test('never offers Discard, specials locked (the mid-action gate)', () => {
    for (const phase of [rowNullPhase, rowPickedPhase]) {
      probe(baseState(phase));
      expect(ui.actions.map(a => a.id)).not.toContain('discard');
      expect(ui.canActivateSpecials).toBe(false);
    }
  });

  test('Back appears while a draw remains, and returns to holding', () => {
    probe(baseState({ ...rowPickedPhase, draws: 1 }));
    expect(ui.actions.map(a => a.id)).toEqual(['place-hand', 'back']);
    ui.actions.find(a => a.id === 'back')!.onPress();
    expect(dispatch).toHaveBeenCalledWith({ type: 'CANCEL_ACTION' });
    // Both draws spent — no Back (also hidden on a dry deck).
    probe(baseState({ ...rowPickedPhase, draws: 2 }));
    expect(ui.actions.map(a => a.id)).toEqual(['place-hand']);
    probe({ ...baseState({ ...rowPickedPhase, draws: 1 }), deck: [] });
    expect(ui.actions.map(a => a.id)).toEqual(['place-hand']);
  });
});
