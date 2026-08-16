import { Card, Rank, StandardCard, Suit } from '../cards';
import {
  BONUS_DECK_POOL,
  BonusCard,
  powerUpBonusCard,
} from '../bonusCards';
import { emptyGrid, Grid, GRID_SLOTS } from '../grid';
import { HAND_BASE_VALUE, ScoredLine, scoreGrid } from '../scoring';
import { categoryOf } from '../../lib/bonusCardCategory';
import { cardLineMult } from '../../features/game/lineInsights';

const C = (rank: Rank, suit: Suit): StandardCard => ({
  kind: 'standard',
  rank,
  suit,
});
const JK: Card = { kind: 'joker' };

const findCard = (id: string): BonusCard => {
  const c = BONUS_DECK_POOL.find(b => b.id === id);
  if (!c) throw new Error(`No bonus card ${id}`);
  return c;
};

// Row 0 holds the line under test; junk fills the rest so every line
// is complete (junk rows are 2C/3D/4S/6H/7C high cards; columns become
// four-of-a-kinds, none of which matter to the row-0 assertions).
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

// Column 0 holds the line under test (top → bottom); the rest of each
// row is junk with ranks that keep the rows as no-pair high cards.
const gridWithCol0 = (line: Card[]): Grid => {
  const g: Grid = emptyGrid();
  const junkRanks: Rank[] = ['2', '3', '4', '6'];
  const junkSuits: Suit[] = ['C', 'D', 'S', 'H'];
  for (let r = 0; r < 5; r++) {
    g[r * 5] = line[r];
    for (let cIdx = 1; cIdx < 5; cIdx++) {
      g[r * 5 + cIdx] = C(junkRanks[cIdx - 1], junkSuits[cIdx - 1]);
    }
  }
  return g;
};

const row0With = (grid: Grid, card: BonusCard): ScoredLine =>
  scoreGrid(grid, [card]).lines.find(l => l.kind === 'row' && l.index === 0)!;

const col0With = (grid: Grid, card: BonusCard): ScoredLine =>
  scoreGrid(grid, [card]).lines.find(l => l.kind === 'col' && l.index === 0)!;

describe('Oddball ×2 — lines of only 3/5/7/9', () => {
  const oddball = findCard('oddball-x2');

  it('doubles an all-odd pair line', () => {
    const row0 = row0With(
      gridWithRow0([C('3', 'H'), C('3', 'C'), C('5', 'D'), C('7', 'S'), C('9', 'H')]),
      oddball
    );
    expect(row0.hand).toBe('PAIR');
    expect(row0.multiplier).toBe(2);
    expect(row0.total).toBe(HAND_BASE_VALUE.PAIR * 2);
  });

  it('doubles all-odd quads', () => {
    const row0 = row0With(
      gridWithRow0([C('5', 'H'), C('5', 'C'), C('5', 'D'), C('5', 'S'), C('9', 'H')]),
      oddball
    );
    expect(row0.hand).toBe('FOUR_OF_A_KIND');
    expect(row0.total).toBe(HAND_BASE_VALUE.FOUR_OF_A_KIND * 2);
  });

  it('a single even or face card kills it', () => {
    const even = row0With(
      gridWithRow0([C('3', 'H'), C('3', 'C'), C('5', 'D'), C('7', 'S'), C('4', 'H')]),
      oddball
    );
    expect(even.multiplier).toBe(1);
    const face = row0With(
      gridWithRow0([C('3', 'H'), C('3', 'C'), C('5', 'D'), C('7', 'S'), C('J', 'H')]),
      oddball
    );
    expect(face.multiplier).toBe(1);
  });

  it('a joker never blocks (dual identity — its scoring rank is separate)', () => {
    const row0 = row0With(
      gridWithRow0([C('3', 'H'), C('5', 'C'), C('7', 'D'), C('9', 'S'), JK]),
      oddball
    );
    expect(row0.multiplier).toBe(2);
  });
});

describe('Even Steven ×2 — lines of only 2/4/6/8/10', () => {
  const evenSteven = findCard('even-steven-x2');

  it('doubles an all-even pair line', () => {
    const row0 = row0With(
      gridWithRow0([C('2', 'H'), C('2', 'C'), C('4', 'D'), C('6', 'S'), C('10', 'H')]),
      evenSteven
    );
    expect(row0.hand).toBe('PAIR');
    expect(row0.total).toBe(HAND_BASE_VALUE.PAIR * 2);
  });

  it('fires on 2-4-6-8-10 but the High Card base keeps the total at 0 (the whiff)', () => {
    const row0 = row0With(
      gridWithRow0([C('2', 'H'), C('4', 'C'), C('6', 'D'), C('8', 'S'), C('10', 'H')]),
      evenSteven
    );
    expect(row0.hand).toBe('HIGH_CARD');
    expect(row0.multiplier).toBe(2);
    expect(row0.total).toBe(0);
  });

  it('an odd card kills it; a joker does not', () => {
    const spoiled = row0With(
      gridWithRow0([C('2', 'H'), C('2', 'C'), C('4', 'D'), C('6', 'S'), C('9', 'H')]),
      evenSteven
    );
    expect(spoiled.multiplier).toBe(1);
    const joker = row0With(
      gridWithRow0([C('2', 'H'), C('4', 'C'), C('6', 'D'), C('8', 'S'), JK]),
      evenSteven
    );
    expect(joker.multiplier).toBe(2);
  });
});

describe('Stairway ×2 — ranks strictly ascending in reading order', () => {
  const stairway = findCard('stairway-x3');

  it('doubles an in-order straight (rows read left to right)', () => {
    const row0 = row0With(
      gridWithRow0([C('5', 'H'), C('6', 'C'), C('7', 'D'), C('8', 'S'), C('9', 'H')]),
      stairway
    );
    expect(row0.hand).toBe('STRAIGHT');
    expect(row0.total).toBe(HAND_BASE_VALUE.STRAIGHT * 2);
  });

  it('fires on an ordered High Card line — worth 0, by design', () => {
    const row0 = row0With(
      gridWithRow0([C('2', 'H'), C('5', 'C'), C('8', 'D'), C('J', 'S'), C('K', 'H')]),
      stairway
    );
    expect(row0.hand).toBe('HIGH_CARD');
    expect(row0.multiplier).toBe(2);
    expect(row0.total).toBe(0);
  });

  it('an out-of-order straight does not fire', () => {
    const row0 = row0With(
      gridWithRow0([C('6', 'H'), C('5', 'C'), C('7', 'D'), C('8', 'S'), C('9', 'H')]),
      stairway
    );
    expect(row0.multiplier).toBe(1);
  });

  it('duplicate ranks never qualify', () => {
    const row0 = row0With(
      gridWithRow0([C('3', 'H'), C('3', 'C'), C('5', 'D'), C('7', 'S'), C('9', 'H')]),
      stairway
    );
    expect(row0.multiplier).toBe(1);
  });

  it('ace works low at the head or high at the tail — never mid-line', () => {
    const aceLow = row0With(
      gridWithRow0([C('A', 'H'), C('4', 'C'), C('7', 'D'), C('9', 'S'), C('J', 'H')]),
      stairway
    );
    expect(aceLow.multiplier).toBe(2);
    const aceHigh = row0With(
      gridWithRow0([C('3', 'H'), C('7', 'C'), C('9', 'D'), C('J', 'S'), C('A', 'H')]),
      stairway
    );
    expect(aceHigh.multiplier).toBe(2);
    const aceMid = row0With(
      gridWithRow0([C('3', 'H'), C('7', 'C'), C('A', 'D'), C('J', 'S'), C('K', 'H')]),
      stairway
    );
    expect(aceMid.multiplier).toBe(1);
  });

  it("the user's joker examples: A,🃏,3,6,8 qualifies; A,🃏,2,6,8 does not", () => {
    // Joker reads as 2 for the bonus even though hand scoring resolves
    // it separately (likely into a pair).
    const fits = row0With(
      gridWithRow0([C('A', 'H'), JK, C('3', 'D'), C('6', 'S'), C('8', 'H')]),
      stairway
    );
    expect(fits.multiplier).toBe(2);
    // No rank exists strictly between A(low) and 2, and repeating A or
    // 2 breaks the uniqueness rule.
    const noFit = row0With(
      gridWithRow0([C('A', 'H'), JK, C('2', 'D'), C('6', 'S'), C('8', 'H')]),
      stairway
    );
    expect(noFit.multiplier).toBe(1);
  });

  it('a trailing joker can stand in for the high ace', () => {
    const row0 = row0With(
      gridWithRow0([C('9', 'H'), C('J', 'C'), C('Q', 'D'), C('K', 'S'), JK]),
      stairway
    );
    expect(row0.multiplier).toBe(2);
  });

  it('a joker cannot be an ace the line already holds', () => {
    // 🃏,2,5,9,A: the joker's only sub-2 identity is the ace, which is
    // taken — the ace-high read fails outright (A can't sit above 9
    // while something ascends past it at the front).
    const row0 = row0With(
      gridWithRow0([JK, C('2', 'H'), C('5', 'D'), C('9', 'S'), C('A', 'H')]),
      stairway
    );
    expect(row0.multiplier).toBe(1);
  });
});

describe('Waterfall ×2 — ranks strictly descending in reading order', () => {
  const waterfall = findCard('waterfall-x3');

  it('doubles a descending straight row', () => {
    const row0 = row0With(
      gridWithRow0([C('9', 'H'), C('8', 'C'), C('7', 'D'), C('6', 'S'), C('5', 'H')]),
      waterfall
    );
    expect(row0.total).toBe(HAND_BASE_VALUE.STRAIGHT * 2);
  });

  it('columns read top to bottom', () => {
    const col0 = col0With(
      gridWithCol0([C('K', 'H'), C('J', 'C'), C('8', 'D'), C('5', 'S'), C('2', 'H')]),
      waterfall
    );
    expect(col0.multiplier).toBe(2);
    // The same cards bottom-to-top do NOT count as descending.
    const rising = col0With(
      gridWithCol0([C('2', 'H'), C('5', 'S'), C('8', 'D'), C('J', 'C'), C('K', 'H')]),
      waterfall
    );
    expect(rising.multiplier).toBe(1);
  });

  it('an ascending row does not fire Waterfall', () => {
    const row0 = row0With(
      gridWithRow0([C('5', 'H'), C('6', 'C'), C('7', 'D'), C('8', 'S'), C('9', 'H')]),
      waterfall
    );
    expect(row0.multiplier).toBe(1);
  });
});

describe('partial-line probing', () => {
  const stairway = findCard('stairway-x3');
  const oddball = findCard('oddball-x2');

  const partialRow = (cards: (Card | null)[]): ScoredLine => {
    const g = emptyGrid();
    for (let i = 0; i < 5; i++) g[i] = cards[i];
    return scoreGrid(g, [], { ignoreIncompletePenalty: true }).lines.find(
      l => l.kind === 'row' && l.index === 0
    )!;
  };

  it('Stairway stays dark on an ordered 4-card partial (full lines only)', () => {
    const line = partialRow([C('2', 'H'), C('5', 'C'), C('8', 'D'), C('J', 'S'), null]);
    expect(cardLineMult(stairway, line, [line])).toBe(1);
  });

  it('Oddball lights up on an all-odd partial (forming feedback)', () => {
    const line = partialRow([C('3', 'H'), C('5', 'C'), C('7', 'D'), null, null]);
    expect(cardLineMult(oddball, line, [line])).toBe(2);
  });
});

describe('catalog wiring', () => {
  it('all four are yellow conditionals with power-up-ready values', () => {
    for (const [id, mult] of [
      ['oddball-x2', 2],
      ['even-steven-x2', 2],
      // Stairway/Waterfall retuned to ×2 — ids keep their x3 tags.
      ['stairway-x3', 2],
      ['waterfall-x3', 2],
    ] as const) {
      const card = findCard(id);
      expect(card.lineEffect).toBeDefined();
      expect(card.gridEffect).toBeUndefined();
      expect(card.multValue).toBe(mult);
      expect(categoryOf(card)).toBe('conditional');
      expect(card.mult).toContain(`×${mult}`);
    }
  });

  it('power-ups scale them on the generic ×1.2 path', () => {
    const powered = powerUpBonusCard(findCard('stairway-x3'));
    expect(powered.multValue).toBe(2.4);
    expect(powered.mult).toContain('×2.4');
    const poweredOdd = powerUpBonusCard(findCard('oddball-x2'));
    expect(poweredOdd.multValue).toBe(2.4);
  });
});
