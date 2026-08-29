import { Card, Rank, StandardCard, Suit } from '../cards';
import { emptyGrid, Grid, GRID_SLOTS } from '../grid';
import { scoreGrid } from '../scoring';

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

  it('prices The Nuts at a flat 150 — suits carry no bonus', () => {
    const rainbowNuts = row0Of(
      gridWithRow0([
        C('7', 'S'), C('5', 'H'), C('4', 'D'), C('3', 'C'), C('2', 'S'),
      ]),
      true
    );
    expect(rainbowNuts.lowHand).toBe('THE_NUTS');
    expect(rainbowNuts.base).toBe(150);
    expect(rainbowNuts.flat).toBe(0);
    expect(rainbowNuts.total).toBe(150);
    // Three suits, same ranks — identical score.
    const threeSuitNuts = row0Of(
      gridWithRow0([
        C('7', 'S'), C('5', 'S'), C('4', 'D'), C('3', 'C'), C('2', 'S'),
      ]),
      true
    );
    expect(threeSuitNuts.total).toBe(150);
  });

  it('a busted line costs 50', () => {
    const row0 = row0Of(
      gridWithRow0([
        C('2', 'H'), C('2', 'C'), C('5', 'D'), C('5', 'S'), C('K', 'H'),
      ]),
      true
    );
    expect(row0.lowHand).toBe('BUSTED');
    // hand keeps the HIGH evaluation — completeness checks stay intact.
    expect(row0.hand).toBe('TWO_PAIR');
    expect(row0.base).toBe(-50);
    expect(row0.total).toBe(-50);
  });

  it('a single pair busts too — no hand scores zero', () => {
    const row0 = row0Of(
      gridWithRow0([
        C('2', 'H'), C('2', 'C'), C('5', 'D'), C('8', 'S'), C('K', 'H'),
      ]),
      true
    );
    expect(row0.lowHand).toBe('BUSTED');
    expect(row0.total).toBe(-50);
  });

  it("unfinished lines cost the mode's own -50", () => {
    // 10 unfinished lines × -50 in the subtotal; the final total still
    // floors at 0 like every mode's.
    const empty = emptyGrid();
    const report = scoreGrid(empty, [], { lowball: true });
    expect(report.subtotal).toBe(-500);
    expect(report.total).toBe(0);
    expect(
      scoreGrid(empty, [], { lowball: true, ignoreIncompletePenalty: true })
        .total
    ).toBe(0);
    // ...while the high game keeps its -25 per line in the subtotal.
    expect(scoreGrid(empty, []).subtotal).toBe(-250);
    // Incomplete lines carry lowHand: null (not undefined) in lowball.
    const { lines } = scoreGrid(empty, [], { lowball: true });
    for (const l of lines) expect(l.lowHand).toBeNull();
  });
});
