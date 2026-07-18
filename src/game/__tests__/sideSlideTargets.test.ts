// Slip & Slide destination tap targets. Regression: with the old
// "tap where the chain leader lands" mapping, a plain 1-step slide
// toward the chain's own tail put the target INSIDE the chain (the
// leader vacates into a slot another member holds) — undiscoverable
// and untappable, so sliding 3 adjacent cards one step right was
// refused even though the move itself was legal.

import { Card } from '../cards';
import {
  sideSlideDestinationsForChain,
  sideSlideTapTargets,
} from '../actions';

const c = (rank: string, suit: string): Card =>
  ({ kind: 'standard', rank, suit }) as Card;

const emptyGrid = (): (Card | null)[] => Array(25).fill(null);

describe('sideSlideTapTargets', () => {
  it('offers a 1-step slide as a tap on the cell just past the chain', () => {
    // Row 1, cols 1–3 occupied by the chain; everything else empty.
    const grid = emptyGrid();
    grid[6] = c('A', 'S');
    grid[7] = c('K', 'H');
    grid[8] = c('Q', 'D');
    const chain = [6, 7, 8];
    const targets = sideSlideTapTargets(
      chain,
      sideSlideDestinationsForChain(grid, chain)
    );

    // Slide right 1: tap slot 9 (the cell past the chain's right end).
    expect(targets.get(9)).toEqual(['right']);
    // Slide left 1: tap slot 5.
    expect(targets.get(5)).toEqual(['left']);
    // Perpendicular 1-step slides: any cell of the row above / below.
    expect(targets.get(1)).toEqual(['up']);
    expect(targets.get(11)).toEqual(['down']);
    // No target ever sits inside the chain itself.
    for (const slot of chain) expect(targets.has(slot)).toBe(false);
  });

  it("the reported case: chain's only legal move is a 1-step slide", () => {
    // Fill the whole grid except the cell just right of the chain —
    // the only legal move is sliding the chain 1 step right.
    const grid = emptyGrid();
    for (let i = 0; i < 25; i++) grid[i] = c('2', 'C');
    grid[9] = null;
    grid[6] = c('A', 'S');
    grid[7] = c('K', 'H');
    grid[8] = c('Q', 'D');
    const chain = [6, 7, 8];
    const moves = sideSlideDestinationsForChain(grid, chain);
    expect(moves.length).toBe(1);

    const targets = sideSlideTapTargets(chain, moves);
    expect([...targets.keys()]).toEqual([9]);
    expect(targets.get(9)).toEqual(['right']);
  });

  it('a farther tap commits the longer slide; the near cell stays 1-step', () => {
    const grid = emptyGrid();
    grid[6] = c('A', 'S');
    grid[7] = c('K', 'H');
    const chain = [6, 7];
    const targets = sideSlideTapTargets(
      chain,
      sideSlideDestinationsForChain(grid, chain)
    );
    expect(targets.get(8)).toEqual(['right']);
    expect(targets.get(9)).toEqual(['right', 'right']);
  });
});
