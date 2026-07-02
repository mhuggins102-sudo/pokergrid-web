import { emptyGrid } from '../../../game/grid';
import { HAND_BASE_VALUE, scoreGrid } from '../../../game/scoring';
import { Rank, StandardCard, Suit } from '../../../game/cards';
import { investedBase } from '../lineBonuses';

const C = (rank: Rank, suit: Suit): StandardCard => ({
  kind: 'standard',
  rank,
  suit,
});

describe('investedBase', () => {
  it('splits a Bull Market boosted base into table value + invest', () => {
    const g = emptyGrid();
    // Row 0 scores a Pair.
    g[0] = C('2', 'H');
    g[1] = C('2', 'C');
    g[2] = C('5', 'D');
    g[3] = C('8', 'S');
    g[4] = C('K', 'H');
    const report = scoreGrid(g, [], { handBoost: { PAIR: 14 } });
    const pairLine = report.lines.find(l => l.hand === 'PAIR')!;
    expect(pairLine.base).toBe(HAND_BASE_VALUE.PAIR + 14);
    expect(investedBase(pairLine)).toEqual({
      raw: HAND_BASE_VALUE.PAIR,
      invested: 14,
    });
  });

  it('reports zero invest outside Bull Market', () => {
    const g = emptyGrid();
    g[0] = C('2', 'H');
    g[1] = C('2', 'C');
    g[2] = C('5', 'D');
    g[3] = C('8', 'S');
    g[4] = C('K', 'H');
    const report = scoreGrid(g, []);
    const pairLine = report.lines.find(l => l.hand === 'PAIR')!;
    expect(investedBase(pairLine)).toEqual({
      raw: HAND_BASE_VALUE.PAIR,
      invested: 0,
    });
  });
});
