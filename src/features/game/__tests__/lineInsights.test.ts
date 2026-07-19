import { Card, Rank, StandardCard, Suit } from '../../../game/cards';
import { BONUS_DECK_POOL, BonusCard } from '../../../game/bonusCards';
import { Grid, emptyGrid } from '../../../game/grid';
import { scoreGrid } from '../../../game/scoring';
import {
  cardFiresOnLine,
  cardLineMult,
  endgameRows,
  lineGoldMult,
  linePotential,
  purpleProgress,
} from '../lineInsights';

const C = (rank: Rank, suit: Suit): StandardCard => ({
  kind: 'standard',
  rank,
  suit,
});

const findCard = (id: string): BonusCard => {
  const c = BONUS_DECK_POOL.find(b => b.id === id);
  if (!c) throw new Error(`No bonus card ${id}`);
  return c;
};

const report = (grid: Grid, cards: BonusCard[] = []) =>
  scoreGrid(grid, cards, { ignoreIncompletePenalty: true });

const lineOf = (grid: Grid, cards: BonusCard[], kind: 'row' | 'col', index: number) => {
  const r = report(grid, cards);
  const line = r.lines.find(l => l.kind === kind && l.index === index)!;
  return { line, lines: r.lines };
};

const place = (grid: Grid, idx: number, card: Card): void => {
  grid[idx] = card;
};

describe('cardLineMult / cardFiresOnLine', () => {
  test('location card (Crossroads) fires on an INCOMPLETE center row', () => {
    const g = emptyGrid();
    place(g, 12, C('9', 'H')); // row 3 / col 3 center
    const crossroads = findCard('spiral-core-x1_5');
    const { line, lines } = lineOf(g, [crossroads], 'row', 2);
    expect(line.hand).toBeNull();
    expect(cardLineMult(crossroads, line, lines)).toBe(1.5);
    expect(cardFiresOnLine(crossroads, line, lines)).toBe(true);
  });

  test('hand-type card (Pair ×4) fires on a FORMING pair', () => {
    const g = emptyGrid();
    place(g, 0, C('8', 'H'));
    place(g, 1, C('8', 'S'));
    const pair = findCard('hand-pair-x4');
    const { line, lines } = lineOf(g, [pair], 'row', 0);
    expect(cardLineMult(pair, line, lines)).toBe(4);
    expect(cardFiresOnLine(pair, line, lines)).toBe(true);
  });

  test('hand-type card stays quiet while the partial makes nothing', () => {
    const g = emptyGrid();
    place(g, 0, C('8', 'H'));
    place(g, 1, C('K', 'S'));
    const pair = findCard('hand-pair-x4');
    const { line, lines } = lineOf(g, [pair], 'row', 0);
    expect(cardLineMult(pair, line, lines)).toBe(1);
    expect(cardFiresOnLine(pair, line, lines)).toBe(false);
  });

  test('made line uses the real scoring multiplier', () => {
    const g = emptyGrid();
    const row: Card[] = [C('8', 'H'), C('8', 'S'), C('2', 'D'), C('5', 'C'), C('K', 'H')];
    row.forEach((c, i) => place(g, i, c));
    const pair = findCard('hand-pair-x4');
    const { line, lines } = lineOf(g, [pair], 'row', 0);
    expect(line.hand).toBe('PAIR');
    expect(cardLineMult(pair, line, lines)).toBe(4);
    expect(lineGoldMult(line, [pair], lines)).toBe(4);
  });

  test('card-property card (Royal Touch) fires on a partial line with an Ace', () => {
    const g = emptyGrid();
    place(g, 0, C('A', 'H'));
    const royal = findCard('royal-touch-x1_5');
    const { line, lines } = lineOf(g, [royal], 'row', 0);
    expect(cardLineMult(royal, line, lines)).toBe(1.5);
  });
});

describe('linePotential', () => {
  test('empty line → none / – / no name', () => {
    const { line, lines } = lineOf(emptyGrid(), [], 'row', 0);
    expect(linePotential(line, [], lines)).toEqual({
      tone: 'none',
      label: '–',
      name: '',
      mult: 1,
      filled: 0,
      value: 0,
    });
  });

  test('partial pair + location multiplier → DASHED gold, boosted potential', () => {
    const g = emptyGrid();
    place(g, 10, C('8', 'H')); // row 3
    place(g, 11, C('8', 'S'));
    const crossroads = findCard('spiral-core-x1_5');
    const { line, lines } = lineOf(g, [crossroads], 'row', 2);
    const p = linePotential(line, [crossroads], lines);
    // Pair base 5 × 1.5 = 7.5 → ceil 8, mirroring the mockup's formula.
    expect(p).toMatchObject({
      tone: 'goldPotential',
      label: '+8',
      name: 'Pair',
      mult: 1.5,
      value: 8,
    });
  });

  test('forming pair + held Pair ×4 → DASHED gold with the hand-keyed mult', () => {
    const g = emptyGrid();
    place(g, 0, C('8', 'H'));
    place(g, 1, C('8', 'S'));
    const pair = findCard('hand-pair-x4');
    const { line, lines } = lineOf(g, [pair], 'row', 0);
    expect(linePotential(line, [pair], lines)).toMatchObject({
      tone: 'goldPotential',
      label: '+20', // ceil(5 × 4)
      name: 'Pair',
      mult: 4,
    });
  });

  test('partial pair without multipliers → dashed potential', () => {
    const g = emptyGrid();
    place(g, 0, C('8', 'H'));
    place(g, 1, C('8', 'S'));
    const { line, lines } = lineOf(g, [], 'row', 0);
    expect(linePotential(line, [], lines)).toMatchObject({
      tone: 'potential',
      label: '+5',
      name: 'Pair',
    });
  });

  test('cards but no hand yet → wip / In Progress', () => {
    const g = emptyGrid();
    place(g, 0, C('8', 'H'));
    place(g, 1, C('K', 'S'));
    const { line, lines } = lineOf(g, [], 'row', 0);
    expect(linePotential(line, [], lines)).toMatchObject({
      tone: 'wip',
      label: '–',
      name: 'In Progress',
    });
  });

  test('made pair with Pair ×4 → gold, actual points', () => {
    const g = emptyGrid();
    [C('8', 'H'), C('8', 'S'), C('2', 'D'), C('5', 'C'), C('K', 'H')].forEach(
      (c, i) => place(g, i, c)
    );
    const pair = findCard('hand-pair-x4');
    const { line, lines } = lineOf(g, [pair], 'row', 0);
    expect(linePotential(line, [pair], lines)).toMatchObject({
      tone: 'gold',
      label: '+20', // ceil(5 × 4)
      name: 'Pair',
      mult: 4,
    });
  });

  test('hand boost raises the partial potential base', () => {
    const g = emptyGrid();
    place(g, 0, C('8', 'H'));
    place(g, 1, C('8', 'S'));
    const { line, lines } = lineOf(g, [], 'row', 0);
    const p = linePotential(line, [], lines, { PAIR: 10 });
    expect(p.label).toBe('+15'); // (5 + 10) × 1
  });

  test('complete High Card line → none tone but named for the tooltip', () => {
    const g = emptyGrid();
    [C('2', 'H'), C('5', 'S'), C('7', 'D'), C('9', 'C'), C('K', 'H')].forEach(
      (c, i) => place(g, i, c)
    );
    const { line, lines } = lineOf(g, [], 'row', 0);
    expect(linePotential(line, [], lines)).toMatchObject({
      tone: 'none',
      label: '–',
      name: 'High Card',
      filled: 5,
    });
  });
});

describe('purpleProgress / endgameRows', () => {
  const inputsFor = (grid: Grid, cards: BonusCard[], deckRemaining = 0) => {
    const r = report(grid, cards);
    return {
      grid,
      lines: r.lines,
      deckRemaining,
      discards: [],
      perkSpent: [],
    };
  };

  test('Balance reports met lines and their tags', () => {
    const g = emptyGrid();
    [C('8', 'H'), C('8', 'S'), C('2', 'D'), C('5', 'C'), C('K', 'H')].forEach(
      (c, i) => place(g, i, c)
    );
    const balance = findCard('balance-x1_25');
    const p = purpleProgress(balance, inputsFor(g, [balance]))!;
    expect(p.label).toBe('1 / 10 lines Pair or better');
    expect(p.ok).toBe(false);
    expect([...p.tags]).toEqual(['R1']);
  });

  test('No Flushes flags the offending flush line', () => {
    const g = emptyGrid();
    [C('2', 'H'), C('5', 'H'), C('7', 'H'), C('9', 'H'), C('K', 'H')].forEach(
      (c, i) => place(g, i, c)
    );
    const noFlushes = findCard('no-flushes-x1_25');
    const p = purpleProgress(noFlushes, inputsFor(g, [noFlushes]))!;
    expect(p.ok).toBe(false);
    expect(p.label).toBe('1 flush line(s) — would break it');
    expect([...p.tags]).toEqual(['R1']);
    // With no flushes on the board it reports on-track.
    const clean = purpleProgress(noFlushes, inputsFor(emptyGrid(), [noFlushes]))!;
    expect(clean.ok).toBe(true);
    expect(clean.label).toBe('No flushes yet — on track');
  });

  test('Speedrun reports the deck count and never tags lines', () => {
    const speedrun = findCard('deck-bank-x1_05');
    const p = purpleProgress(speedrun, inputsFor(emptyGrid(), [speedrun], 12))!;
    expect(p.label).toBe('12 cards left in deck');
    expect(p.ok).toBe(true);
    expect(p.tags.size).toBe(0);
  });

  test('in-game / special cards return null', () => {
    const pair = findCard('hand-pair-x4');
    expect(purpleProgress(pair, inputsFor(emptyGrid(), []))).toBeNull();
  });

  test('endgameRows lists only firing purple cards with their payout', () => {
    const speedrun = findCard('deck-bank-x1_05');
    const balance = findCard('balance-x1_25');
    const rows = endgameRows(
      [speedrun, balance],
      inputsFor(emptyGrid(), [speedrun, balance], 10)
    );
    // Speedrun fires (1.04^10 ≈ 1.48); Balance doesn't on an empty grid.
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Speedrun');
    expect(rows[0].value).toBe('×1.48');
  });
});
