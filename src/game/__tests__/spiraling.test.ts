import { seededRng } from '../deck';
import { findChallenge } from '../challenges';
import {
  canSpiral,
  spiralDestination,
  spiralHopPath,
  spiralPipValue,
  spiralableSlots,
  suitActionAvailable,
} from '../actions';
import { Card, Rank, Suit } from '../cards';
import { Grid, SPIRAL_ORDER, SPIRAL_POSITION } from '../grid';
import { GameState, newGame, step } from '../state';

const card = (rank: Rank, suit: Suit): Card => ({
  kind: 'standard',
  rank,
  suit,
});

const emptyGrid = (): Grid => Array.from({ length: 25 }, () => null) as Grid;

// Place filler cards at the given SPIRAL POSITIONS (1-based, as the
// player reads them) — the spec is written in spiral space.
const gridAtPositions = (...positions: number[]): Grid => {
  const g = emptyGrid();
  for (const p of positions) g[SPIRAL_ORDER[p - 1]] = card('7', 'H');
  return g;
};

const slotAt = (position: number): number => SPIRAL_ORDER[position - 1];

// A Spiraling game with a hand-authored grid and a chosen drawn spade —
// the reducer flows spend the drawn card, and its pips set the distance.
const spiralGame = (grid: Grid, drawnRank: Rank = '9'): GameState => {
  const s = newGame('hard', seededRng(42), {
    targetOverride: findChallenge('spiraling').scoreTarget,
    spiraling: true,
  });
  return { ...s, grid, drawn: card(drawnRank, 'S') };
};

describe('Spiraling — pip values', () => {
  it('A=1, numbers face value, J=11, Q=12, K=13', () => {
    expect(spiralPipValue(card('A', 'S'))).toBe(1);
    expect(spiralPipValue(card('2', 'S'))).toBe(2);
    expect(spiralPipValue(card('9', 'S'))).toBe(9);
    expect(spiralPipValue(card('10', 'S'))).toBe(10);
    expect(spiralPipValue(card('J', 'S'))).toBe(11);
    expect(spiralPipValue(card('Q', 'S'))).toBe(12);
    expect(spiralPipValue(card('K', 'S'))).toBe(13);
  });
});

describe('Spiraling — spiralDestination', () => {
  it("the user's example: space 1 + a 9♠ lands on space 10 (R2C5)", () => {
    const g = gridAtPositions(1);
    const dest = spiralDestination(g, slotAt(1), 9);
    expect(dest).toBe(slotAt(10));
    // Space 10 is row 2, column 5 (slot index 9).
    expect(dest).toBe(9);
  });

  it('jumps over occupied spaces along the way', () => {
    // Cards on every space between source and destination — only the
    // LANDING space matters.
    const g = gridAtPositions(1, 2, 3, 4);
    expect(spiralDestination(g, slotAt(1), 4)).toBe(slotAt(5));
  });

  it('null when the landing space is occupied', () => {
    const g = gridAtPositions(1, 10);
    expect(spiralDestination(g, slotAt(1), 9)).toBeNull();
  });

  it('null when the move runs past the end of the spiral', () => {
    // Space 20 + 9 pips = 29 > 25.
    const g = gridAtPositions(20);
    expect(spiralDestination(g, slotAt(20), 9)).toBeNull();
    // Space 25 can never move.
    const g2 = gridAtPositions(25);
    expect(spiralDestination(g2, slotAt(25), 1)).toBeNull();
  });

  it('landing exactly on space 25 is legal', () => {
    const g = gridAtPositions(16);
    expect(spiralDestination(g, slotAt(16), 9)).toBe(slotAt(25));
  });

  it('spiralHopPath walks every space from source+1 through the landing', () => {
    const path = spiralHopPath(slotAt(1), slotAt(10));
    expect(path).toHaveLength(9);
    expect(path).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10].map(slotAt));
    // Sanity: positions are consecutive in spiral space.
    expect(path.map(i => SPIRAL_POSITION[i])).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('spiralableSlots lists only in-range, empty-landing sources', () => {
    // Space 1 → 10 open; space 20 → 29 out of range; space 3 → 12 open.
    const g = gridAtPositions(1, 3, 20);
    expect(new Set(spiralableSlots(g, 9))).toEqual(
      new Set([slotAt(1), slotAt(3)])
    );
    expect(canSpiral(gridAtPositions(20), 9)).toBe(false);
  });
});

describe('Spiraling — reducer flow', () => {
  it('♠ opens the spiral phase with the drawn pips as steps', () => {
    let s = spiralGame(gridAtPositions(1, 20), '9');
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    if (s.phase.kind !== 'awaiting-target-spiral') {
      throw new Error(`Expected awaiting-target-spiral, got ${s.phase.kind}`);
    }
    expect(s.phase.steps).toBe(9);
    // Space 20 can't move 9 — only space 1 is a target.
    expect(s.phase.targets).toEqual([slotAt(1)]);
  });

  it('♠ is a no-op when nothing can move that far', () => {
    const s = spiralGame(gridAtPositions(20), 'K');
    const after = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    expect(after.phase.kind).toBe('awaiting-action');
  });

  it('RESOLVE_SPIRAL moves the card by the pips, spends the ♠, draws next', () => {
    let s = spiralGame(gridAtPositions(1), '9');
    const moving = s.grid[slotAt(1)];
    const perkSpentBefore = s.perkSpent.length;
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    s = step(s, { type: 'RESOLVE_SPIRAL', slot: slotAt(1) });
    expect(s.phase.kind).toBe('awaiting-action');
    expect(s.grid[slotAt(1)]).toBeNull();
    expect(s.grid[slotAt(10)]).toBe(moving);
    expect(s.perkSpent.length).toBe(perkSpentBefore + 1);
    // The commit logs the hop for the animation/sound layer.
    expect(s.history[s.history.length - 1]).toBe(
      `Spiral ${slotAt(1)} → ${slotAt(10)}`
    );
  });

  it('RESOLVE_SPIRAL rejects a slot outside the targets', () => {
    let s = spiralGame(gridAtPositions(1, 20), '9');
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    const atPhase = s;
    expect(step(s, { type: 'RESOLVE_SPIRAL', slot: slotAt(20) })).toBe(atPhase);
    expect(step(s, { type: 'RESOLVE_SPIRAL', slot: slotAt(5) })).toBe(atPhase);
  });

  it('CANCEL_ACTION returns to awaiting-action without spending the ♠', () => {
    let s = spiralGame(gridAtPositions(1), 'A');
    const perkSpentBefore = s.perkSpent.length;
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    expect(s.phase.kind).toBe('awaiting-target-spiral');
    s = step(s, { type: 'CANCEL_ACTION' });
    expect(s.phase.kind).toBe('awaiting-action');
    expect(s.perkSpent.length).toBe(perkSpentBefore);
  });

  it('UNDO rewinds a resolved spiral', () => {
    let s = spiralGame(gridAtPositions(1), '5');
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    s = step(s, { type: 'RESOLVE_SPIRAL', slot: slotAt(1) });
    expect(s.grid[slotAt(6)]).not.toBeNull();
    s = step(s, { type: 'UNDO' });
    expect(s.grid[slotAt(1)]).not.toBeNull();
    expect(s.grid[slotAt(6)]).toBeNull();
  });

  it('without the flag, ♠ still opens the slide flow', () => {
    const s = newGame('hard', seededRng(42), { targetOverride: 500 });
    const withDrawn = {
      ...s,
      grid: gridAtPositions(1),
      drawn: card('K', 'S'),
    };
    const after = step(withDrawn, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    expect(after.phase.kind).toBe('awaiting-target-slide-source');
  });
});

describe('Spiraling — availability gate', () => {
  it('suitActionAvailable keys the distance off the drawn spade', () => {
    // A card on space 20: a 5♠ (→ space 25) works, a 6♠ (→ 26) does not.
    const g = gridAtPositions(20);
    expect(
      suitActionAvailable(card('5', 'S'), g, 10, 0, true, false, null, true)
    ).toBe(true);
    expect(
      suitActionAvailable(card('6', 'S'), g, 10, 0, true, false, null, true)
    ).toBe(false);
    // Without the flag it's the slide check (a lone card can slide).
    expect(
      suitActionAvailable(card('6', 'S'), g, 10, 0, true, false, null, false)
    ).toBe(true);
  });
});
