import { seededRng } from '../deck';
import { findChallenge } from '../challenges';
import {
  INNER_RING,
  OUTER_RING,
  canSpin,
  ringOf,
  spinDestination,
  spinnableSlots,
  suitActionAvailable,
} from '../actions';
import { Card, Rank, Suit } from '../cards';
import { Grid } from '../grid';
import { GameState, newGame, step } from '../state';

const card = (rank: Rank, suit: Suit): Card => ({
  kind: 'standard',
  rank,
  suit,
});

const emptyGrid = (): Grid => Array.from({ length: 25 }, () => null) as Grid;

const gridWith = (...slots: number[]): Grid => {
  const g = emptyGrid();
  for (const s of slots) g[s] = card('7', 'H');
  return g;
};

// A Spin Cycle game with a hand-authored grid and a guaranteed standard
// spade drawn — the reducer flows need a non-joker draw to spend.
const spinGame = (grid: Grid): GameState => {
  const s = newGame('hard', seededRng(42), {
    targetOverride: findChallenge('spin-cycle').scoreTarget,
    spinCycle: true,
  });
  return { ...s, grid, drawn: card('K', 'S') };
};

describe('Spin Cycle — ring geometry', () => {
  it('outer ring is the 16 border cells, inner the 8 around center', () => {
    expect(OUTER_RING).toHaveLength(16);
    expect(INNER_RING).toHaveLength(8);
    expect(new Set([...OUTER_RING, ...INNER_RING]).size).toBe(24);
    // The center belongs to neither.
    expect(OUTER_RING).not.toContain(12);
    expect(INNER_RING).not.toContain(12);
    expect(ringOf(12)).toBeNull();
    expect(ringOf(0)).toBe(OUTER_RING);
    expect(ringOf(6)).toBe(INNER_RING);
  });

  it('both rings walk clockwise cell-to-adjacent-cell', () => {
    const adjacent = (a: number, b: number) => {
      const dr = Math.abs(Math.floor(a / 5) - Math.floor(b / 5));
      const dc = Math.abs((a % 5) - (b % 5));
      return dr + dc === 1;
    };
    for (const ring of [OUTER_RING, INNER_RING]) {
      for (let i = 0; i < ring.length; i++) {
        expect(adjacent(ring[i], ring[(i + 1) % ring.length])).toBe(true);
      }
    }
  });
});

describe('Spin Cycle — spinDestination', () => {
  it('moves to the next clockwise cell when it is empty', () => {
    expect(spinDestination(gridWith(0), 0)).toBe(1);
    expect(spinDestination(gridWith(6), 6)).toBe(7);
  });

  it('skips occupied cells to the first empty one', () => {
    // 0's clockwise neighbors 1 and 2 are occupied → lands on 3.
    expect(spinDestination(gridWith(0, 1, 2), 0)).toBe(3);
  });

  it('wraps past the ring start', () => {
    // 5 is the last cell in the outer clockwise order → wraps to 0.
    expect(spinDestination(gridWith(5), 5)).toBe(0);
    // 11 is the last cell in the inner order → wraps to 6.
    expect(spinDestination(gridWith(11), 11)).toBe(6);
  });

  it('returns null for the center cell and for a full ring', () => {
    expect(spinDestination(gridWith(12), 12)).toBeNull();
    // Fully occupied inner ring: no empty cell to rotate into.
    expect(spinDestination(gridWith(...INNER_RING), 6)).toBeNull();
  });

  it('spinnableSlots excludes the center and full-ring cards', () => {
    // Center card + a full inner ring + one outer card: only the outer
    // card (and the inner cards? no — inner ring is FULL) can spin.
    const g = gridWith(12, 0, ...INNER_RING);
    expect(spinnableSlots(g)).toEqual([0]);
    expect(canSpin(gridWith(12))).toBe(false);
  });
});

describe('Spin Cycle — reducer flow', () => {
  it('♠ opens the spin phase with the spinnable targets', () => {
    let s = spinGame(gridWith(0, 12));
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    if (s.phase.kind !== 'awaiting-target-spin') {
      throw new Error(`Expected awaiting-target-spin, got ${s.phase.kind}`);
    }
    // The center card is not a target.
    expect(s.phase.targets).toEqual([0]);
  });

  it('♠ is a no-op when only the center is occupied', () => {
    const s = spinGame(gridWith(12));
    const after = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    expect(after.phase.kind).toBe('awaiting-action');
  });

  it('RESOLVE_SPIN rotates the card, spends the ♠, and draws next', () => {
    let s = spinGame(gridWith(0, 1));
    const moving = s.grid[0];
    const perkSpentBefore = s.perkSpent.length;
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    s = step(s, { type: 'RESOLVE_SPIN', slot: 0 });
    expect(s.phase.kind).toBe('awaiting-action');
    // 1 is occupied → the card lands on 2.
    expect(s.grid[0]).toBeNull();
    expect(s.grid[2]).toBe(moving);
    expect(s.grid[1]).not.toBeNull();
    expect(s.perkSpent.length).toBe(perkSpentBefore + 1);
  });

  it('RESOLVE_SPIN rejects a slot outside the targets', () => {
    let s = spinGame(gridWith(0, 12));
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    const atPhase = s;
    // 12 (center) is not spinnable; 3 is empty.
    expect(step(s, { type: 'RESOLVE_SPIN', slot: 12 })).toBe(atPhase);
    expect(step(s, { type: 'RESOLVE_SPIN', slot: 3 })).toBe(atPhase);
  });

  it('CANCEL_ACTION returns to awaiting-action without spending the ♠', () => {
    let s = spinGame(gridWith(0));
    const perkSpentBefore = s.perkSpent.length;
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    expect(s.phase.kind).toBe('awaiting-target-spin');
    s = step(s, { type: 'CANCEL_ACTION' });
    expect(s.phase.kind).toBe('awaiting-action');
    expect(s.perkSpent.length).toBe(perkSpentBefore);
  });

  it('UNDO rewinds a resolved spin', () => {
    let s = spinGame(gridWith(0));
    s = step(s, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    s = step(s, { type: 'RESOLVE_SPIN', slot: 0 });
    expect(s.grid[0]).toBeNull();
    expect(s.grid[1]).not.toBeNull();
    s = step(s, { type: 'UNDO' });
    expect(s.grid[0]).not.toBeNull();
    expect(s.grid[1]).toBeNull();
  });

  it('without the flag, ♠ still opens the slide flow', () => {
    const s = newGame('hard', seededRng(42), { targetOverride: 500 });
    const g = gridWith(0);
    const withDrawn = { ...s, grid: g, drawn: card('K', 'S') };
    const after = step(withDrawn, { type: 'BEGIN_SUIT_ACTION', forSuit: 'S' });
    expect(after.phase.kind).toBe('awaiting-target-slide-source');
  });
});

describe('Spin Cycle — availability gate', () => {
  it('suitActionAvailable follows spin (not slide) under the flag', () => {
    const spade = card('K', 'S');
    // Center-only board: slide would be available, spin is not.
    const centerOnly = gridWith(12);
    expect(
      suitActionAvailable(spade, centerOnly, 10, 0, true, false, null, true)
    ).toBe(false);
    expect(
      suitActionAvailable(spade, centerOnly, 10, 0, true, false, null, false)
    ).toBe(true);
    // A ring card flips it.
    expect(
      suitActionAvailable(spade, gridWith(0), 10, 0, true, false, null, true)
    ).toBe(true);
  });
});
