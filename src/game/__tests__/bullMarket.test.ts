import { describe, expect, it } from 'vitest';
import { newGame, step, GameState } from '../state';
import { seededRng } from '../deck';
import { clubInvestValue, INVEST_HANDS } from '../invest';
import { effectiveHandBase, scoreGrid } from '../scoring';
import { isJoker } from '../cards';

// Build a Bull Market game (investHands is newGame's last positional arg;
// paired with noBonusCards = true like the real challenge).
const newBullMarket = (rng: () => number) =>
  newGame(
    'hard',
    rng,
    500, // targetOverride
    undefined,
    false,
    false,
    [],
    [],
    [],
    false,
    true, // noBonusCards
    [],
    undefined,
    0,
    false, // scatter
    true // investHands
  );

// Draw cards until a club is in hand, returning that state.
const drawUntilClub = (s: GameState, rng: () => number): GameState => {
  let cur = s;
  for (let i = 0; i < 60 && cur.phase.kind !== 'game-over'; i++) {
    const d = cur.drawn;
    if (d && !isJoker(d) && d.suit === 'C') return cur;
    cur = step(cur, { type: 'PLACE' }, rng);
  }
  return cur;
};

describe('Bull Market', () => {
  it('starts with no bonus cards and the invest flag set', () => {
    const s = newBullMarket(seededRng(3));
    expect(s.investHands).toBe(true);
    expect(s.bonusCards).toEqual([]);
    expect(s.bonusDeck).toEqual([]);
    expect(s.handBoost).toEqual({});
  });

  it('clubInvestValue is 2× the blackjack pip value', () => {
    const v = (rank: string, suit = 'C') =>
      clubInvestValue({ kind: 'standard', rank, suit } as never);
    expect(v('2')).toBe(4);
    expect(v('9')).toBe(18);
    expect(v('10')).toBe(20);
    expect(v('K')).toBe(20);
    expect(v('A')).toBe(22);
  });

  it('the ♣ perk invests the club value into a random hand', () => {
    const rng = seededRng(11);
    const s0 = newBullMarket(rng);
    const atClub = drawUntilClub(s0, rng);
    expect(atClub.drawn).not.toBeNull();
    expect(isJoker(atClub.drawn!) ? '' : atClub.drawn!.suit).toBe('C');

    const expected = clubInvestValue(atClub.drawn!);
    const spinning = step(atClub, { type: 'BEGIN_SUIT_ACTION' }, rng);
    expect(spinning.phase.kind).toBe('club-invest');
    if (spinning.phase.kind !== 'club-invest') throw new Error('phase');
    expect(INVEST_HANDS).toContain(spinning.phase.hand);
    expect(spinning.phase.amount).toBe(expected);

    const resolved = step(spinning, { type: 'RESOLVE_CLUB_INVEST' }, rng);
    const boostedHand = spinning.phase.hand;
    expect(resolved.handBoost[boostedHand]).toBe(expected);
    // The club was spent, not placed.
    expect(resolved.perkSpent.length).toBe(atClub.perkSpent.length + 1);
  });

  it('handBoost raises a hand’s effective base in scoring', () => {
    const boost = { PAIR: 10 } as const;
    expect(effectiveHandBase('PAIR', boost)).toBe(15); // 5 base + 10
    expect(effectiveHandBase('PAIR')).toBe(5);
    // scoreGrid threads it through without error (empty grid, penalties
    // ignored → 0).
    const empty = Array.from({ length: 25 }, () => null);
    expect(
      scoreGrid(empty, [], { handBoost: boost, ignoreIncompletePenalty: true })
        .total
    ).toBe(0);
  });
});
