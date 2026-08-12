import { Card, Rank, StandardCard, Suit } from '../cards';
import { emptyGrid, Grid, GRID_SLOTS } from '../grid';
import { scoreGrid } from '../scoring';
import { RAINBOW_BONUS } from '../lowHands';

const C = (rank: Rank, suit: Suit): StandardCard => ({
  kind: 'standard',
  rank,
  suit,
});

// scoring.test.ts's helper: row 0 is the line under test, everything
// else is junk fill so the whole grid is complete.
const gridWithRow0 = (line: Card[]): Grid => {
  const g: Grid = emptyGrid();
  for (let i = 0; i < 5; i++) g[i] = line[i];
  const junkRanks: Rank[] = ['2', '3', '4', '6', '7'];
  const junkSuits: Suit[] = ['C', 'D', 'S', 'H', 'C'];
  for (let i = 5; i < GRID_SLOTS; i++) {
    g[i] = C(junkRanks[i % junkRanks.length], junkSuits[i % junkSuits.length]);
  }
  return g;
};

const row0Of = (grid: Grid, lowball: boolean) =>
  scoreGrid(grid, [], { lowball })
    .lines.find(l => l.kind === 'row' && l.index === 0)!;

describe('scoreGrid under the lowball option', () => {
  it('leaves lowHand undefined without the option', () => {
    const grid = gridWithRow0([
      C('7', 'S'), C('5', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S'),
    ]);
    const { lines } = scoreGrid(grid, []);
    for (const l of lines) expect(l.lowHand).toBeUndefined();
  });

  it('prices the Number One at 150 with the rainbow flat on top', () => {
    // ♠♥♦♣♠ — all four suits → +25 rainbow.
    const row0 = row0Of(
      gridWithRow0([
        C('7', 'S'), C('5', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S'),
      ]),
      true
    );
    expect(row0.lowHand).toBe('NUMBER_ONE');
    expect(row0.base).toBe(150);
    expect(row0.flat).toBe(RAINBOW_BONUS);
    expect(row0.total).toBe(150 + RAINBOW_BONUS);
  });

  it('withholds the rainbow flat from a three-suit line', () => {
    // ♠♠♦♣♠ — three suits only.
    const row0 = row0Of(
      gridWithRow0([
        C('7', 'S'), C('5', 'S'), C('4', 'D'), C('3', 'C'), C('2', 'S'),
      ]),
      true
    );
    expect(row0.lowHand).toBe('NUMBER_ONE');
    expect(row0.flat).toBe(0);
    expect(row0.total).toBe(150);
  });

  it('a busted rainbow line still collects the +25', () => {
    // Two pair (busted low) across all four suits.
    const row0 = row0Of(
      gridWithRow0([
        C('2', 'H'), C('2', 'C'), C('5', 'D'), C('5', 'S'), C('K', 'H'),
      ]),
      true
    );
    expect(row0.lowHand).toBe('BUSTED');
    // hand keeps the HIGH evaluation — completeness checks stay intact.
    expect(row0.hand).toBe('TWO_PAIR');
    expect(row0.base).toBe(0);
    expect(row0.total).toBe(RAINBOW_BONUS);
  });

  it('keeps the incomplete-line penalty rules', () => {
    const empty = emptyGrid();
    expect(scoreGrid(empty, [], { lowball: true }).total).toBe(-250);
    expect(
      scoreGrid(empty, [], { lowball: true, ignoreIncompletePenalty: true })
        .total
    ).toBe(0);
    // Incomplete lines carry lowHand: null (not undefined) in lowball.
    const { lines } = scoreGrid(empty, [], { lowball: true });
    for (const l of lines) expect(l.lowHand).toBeNull();
  });
});
