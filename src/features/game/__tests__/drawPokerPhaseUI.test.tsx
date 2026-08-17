import { render } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PhaseUI, usePhaseUI } from '../usePhaseUI';
import { Card, Rank, Suit } from '../../../game/cards';

/*
 * Five Draw's two phases through the usePhaseUI lens. The contracts
 * that matter:
 *  - draw-select keeps banner NULL on purpose — the docks hide
 *    Discard/Undo whenever a banner is up, and this is the mode's
 *    resting phase where Undo must stay reachable. Exactly one action
 *    ('draw'), and the HandWell toggles holds.
 *  - draw-place raises a banner (locking Undo out, like the special
 *    phases) and never offers Discard; cells route row-pick /
 *    stage / unstage; 'place-hand' only arms once all 5 are staged.
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
  phase,
});

beforeEach(() => dispatch.mockClear());

describe('draw-select', () => {
  test('no banner (Undo stays reachable), exactly the draw action', () => {
    probe(baseState({ kind: 'draw-select', hand: HAND, kept: [1, 2], handNo: 1 }));
    expect(ui.banner).toBeNull();
    expect(ui.actions.map(a => a.id)).toEqual(['draw']);
    expect(ui.actions[0].label).toBe('Draw 3');
    expect(ui.canActivateSpecials).toBe(false);
    for (let i = 0; i < 25; i++) expect(ui.isTappable(i)).toBe(false);
  });

  test('holding all five relabels the action Stand pat', () => {
    probe(
      baseState({ kind: 'draw-select', hand: HAND, kept: [0, 1, 2, 3, 4], handNo: 3 })
    );
    expect(ui.actions[0].label).toBe('Stand pat');
  });

  test('hand is keep-mode; card taps toggle holds', () => {
    probe(baseState({ kind: 'draw-select', hand: HAND, kept: [1], handNo: 1 }));
    const hand = ui.hand!;
    expect(hand.mode).toBe('keep');
    expect([...hand.marked]).toEqual([1]);
    expect(hand.orderOf(1)).toBeNull();
    expect(hand.tappable(4)).toBe(true);
    hand.onCardTap(4);
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_HAND_KEEP', idx: 4 });
  });
});

describe('draw-place', () => {
  const rowNullPhase = {
    kind: 'draw-place',
    hand: HAND,
    row: null,
    placed: [null, null, null, null, null],
    handNo: 2,
  };

  test('row unpicked: banner asks for a row, only empty rows tappable', () => {
    // Row 0 already seated (a previous hand) — its cells must not offer.
    const grid = emptyGrid();
    for (let i = 0; i < 5; i++) grid[i] = c('3', 'S');
    probe({ ...baseState(rowNullPhase), grid });
    expect(ui.banner).toBe('Hand 2 of 5 — tap an empty row');
    expect(ui.actions.map(a => a.id)).toEqual(['place-hand', 'cancel']);
    expect(ui.actions[0].disabled).toBe(true);
    expect(ui.isTappable(2)).toBe(false); // filled row 0
    expect(ui.isTappable(7)).toBe(true); // empty row 1
    expect(ui.roleOf(7)).toBe('target');
    ui.onCellTap(7);
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLACE_HAND_ROW', row: 1 });
    // Hand cards are inert until a row is chosen.
    expect(ui.hand!.tappable(0)).toBe(false);
  });

  const rowPickedPhase = {
    ...rowNullPhase,
    row: 2,
    placed: [3, null, null, null, null],
  };

  test('row picked: staged cells unstage, open cells stage lowest card', () => {
    probe(baseState(rowPickedPhase));
    expect(ui.banner).toBe('Tap your cards in placing order');
    expect(ui.roleOf(10)).toBe('selected'); // row 2 col 0 — staged
    ui.onCellTap(10);
    expect(dispatch).toHaveBeenCalledWith({ type: 'UNSTAGE_HAND_CARD', col: 0 });
    dispatch.mockClear();
    expect(ui.roleOf(11)).toBe('target'); // row 2 col 1 — open
    ui.onCellTap(11);
    // Lowest unstaged hand index is 0 (only idx 3 is staged).
    expect(dispatch).toHaveBeenCalledWith({
      type: 'STAGE_HAND_CARD',
      idx: 0,
      col: 1,
    });
    dispatch.mockClear();
    // Tapping another empty row switches rows, staging carried along.
    ui.onCellTap(20);
    expect(dispatch).toHaveBeenCalledWith({ type: 'PLACE_HAND_ROW', row: 4 });
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

  test('place-hand arms only with all five staged', () => {
    probe(baseState({ ...rowPickedPhase, placed: [3, 0, 1, 2, 4] }));
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
});
