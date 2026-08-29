import { describe, expect, it } from 'vitest';
import { newGame, step, GameState } from '../state';
import { seededRng } from '../deck';
import { clubInvestValue, INVEST_HANDS } from '../invest';
import { effectiveHandBase, scoreGrid } from '../scoring';
import { isJoker } from '../cards';

// Build a Bull Market game (investHands is newGame's last positional arg;
// paired with noBonusCards = true like the real challenge).
const newBullMarket = (rng: () => number) =>
  newGame('hard', rng, {
    targetOverride: 450,
    noBonusCards: true,
    investHands: true,
  });

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

  it('respin re-rolls the hand for an escalating discard cost', () => {
    const rng = seededRng(11);
    const s0 = newBullMarket(rng);
    const spinning = step(
      drawUntilClub(s0, rng),
      { type: 'BEGIN_SUIT_ACTION' },
      rng
    );
    if (spinning.phase.kind !== 'club-invest') throw new Error('phase');
    expect(spinning.phase.respins).toBe(0);
    const amount = spinning.phase.amount;

    // First respin: 1 card off the deck head into the discards; the
    // phase stays put, the amount never re-rolls.
    const r1 = step(spinning, { type: 'RESPIN_CLUB_INVEST' }, rng);
    if (r1.phase.kind !== 'club-invest') throw new Error('phase');
    expect(r1.phase.respins).toBe(1);
    expect(r1.phase.amount).toBe(amount);
    expect(INVEST_HANDS).toContain(r1.phase.hand);
    expect(r1.deck).toEqual(spinning.deck.slice(1));
    expect(r1.discards).toEqual([...spinning.discards, spinning.deck[0]]);
    expect(r1.history[r1.history.length - 1]).toBe(
      'Respin (1 card discarded)'
    );

    // Second respin costs 2.
    const r2 = step(r1, { type: 'RESPIN_CLUB_INVEST' }, rng);
    if (r2.phase.kind !== 'club-invest') throw new Error('phase');
    expect(r2.phase.respins).toBe(2);
    expect(r2.deck).toEqual(r1.deck.slice(2));
    expect(r2.discards).toEqual([...r1.discards, ...r1.deck.slice(0, 2)]);
    expect(r2.history[r2.history.length - 1]).toBe(
      'Respin (2 cards discarded)'
    );

    // Resolving applies the FINAL hand's boost.
    const resolved = step(r2, { type: 'RESOLVE_CLUB_INVEST' }, rng);
    expect(resolved.handBoost[r2.phase.hand]).toBe(amount);
  });

  it('respin is refused when the deck cannot cover the cost', () => {
    const rng = seededRng(11);
    const s0 = newBullMarket(rng);
    const spinning = step(
      drawUntilClub(s0, rng),
      { type: 'BEGIN_SUIT_ACTION' },
      rng
    );
    if (spinning.phase.kind !== 'club-invest') throw new Error('phase');
    // Second respin would cost 2 — leave only 1 card so it's refused.
    const r1 = step(spinning, { type: 'RESPIN_CLUB_INVEST' }, rng);
    const short: GameState = { ...r1, deck: r1.deck.slice(0, 1) };
    // Refusal returns the IDENTICAL object (rng purity: the stream must
    // not advance on a rejected action).
    expect(step(short, { type: 'RESPIN_CLUB_INVEST' }, rng)).toBe(short);
    // And outside the phase it's a no-op too.
    const idle = newBullMarket(seededRng(4));
    expect(step(idle, { type: 'RESPIN_CLUB_INVEST' }, rng)).toBe(idle);
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
