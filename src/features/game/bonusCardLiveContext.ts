import {
  BonusCard,
  GridSnapshot,
  LineContext,
  isPlaceholder,
  isSpecialCard,
} from '../../game/bonusCards';
import { Suit, isJoker } from '../../game/cards';
import { lines as gridLines } from '../../game/grid';
import { evaluateLine } from '../../game/hands';
import { GameState } from '../../game/state';
import { HAND_LABEL } from './handLabels';

const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', D: '♦', C: '♣' };
const SUIT_NAME: Record<Suit, string> = {
  H: 'Hearts',
  S: 'Spades',
  D: 'Diamonds',
  C: 'Clubs',
};

const trimMult = (m: number): string =>
  m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

/**
 * Live numbers behind a bonus card's condition, shown in the card's
 * detail popup. Two layers:
 *
 *  - Generic, engine-derived status for EVERY scoring card: per-line
 *    cards report how many lines they're firing on right now (the
 *    card's own lineEffect evaluated against the live board), grid
 *    cards report what they'd pay if the game ended now.
 *  - Targeted counters where the condition references a quantity the
 *    player would otherwise have to count by hand (perks spent,
 *    distinct hand types, suit counts, jokers, …).
 */
export const bonusCardLiveContext = (
  card: BonusCard,
  state: GameState
): string[] => {
  if (isPlaceholder(card) || isSpecialCard(card)) return [];

  const baseId = card.id.replace(/-pwr\d+$/, '');
  const out: string[] = [];

  const ctxs: LineContext[] = gridLines(state.grid).map(l => ({
    kind: l.kind,
    index: l.index,
    cards: l.cards,
    hand: evaluateLine(l.cards),
  }));

  // ---- targeted counters ----

  if (baseId === 'burnout-x1_25' || baseId === 'frugal-x1_5') {
    out.push(`Suit perks spent so far: ${state.perkSpent.length}`);
  }
  if (baseId === 'deck-bank-x1_05') {
    out.push(`Deck cards remaining: ${state.deck.length}`);
  }
  if (baseId === 'trash-joker-x1_25') {
    out.push(
      `Jokers destroyed so far: ${state.discards.filter(isJoker).length}`
    );
  }
  if (baseId === 'cozy-joker-x1_15' || baseId === 'joker-line-x1_5') {
    out.push(
      `Jokers on the board: ${state.grid.filter(c => c !== null && isJoker(c)).length}`
    );
  }
  if (baseId.startsWith('suit-density-')) {
    const tail = baseId.slice('suit-density-'.length).toUpperCase();
    if (tail === 'H' || tail === 'S' || tail === 'D' || tail === 'C') {
      const suit = tail as Suit;
      const n = state.grid.filter(
        c => c !== null && !isJoker(c) && c.suit === suit
      ).length;
      out.push(`${SUIT_GLYPH[suit]} ${SUIT_NAME[suit]} on the board: ${n}`);
    }
  }
  if (baseId === 'diversity-x1_25') {
    const types = new Set(
      ctxs.map(c => c.hand).filter(h => h !== null && h !== 'HIGH_CARD')
    );
    out.push(`Distinct scoring hand types right now: ${types.size} (needs 6+)`);
  }
  if (baseId === 'balance-x1_25') {
    const ok = ctxs.filter(c => c.hand !== null && c.hand !== 'HIGH_CARD').length;
    out.push(`Lines at Pair or better: ${ok} of 10`);
  }
  if (baseId === 'no-flushes-x1_25') {
    const n = ctxs.filter(
      c =>
        c.hand === 'FLUSH' || c.hand === 'STRAIGHT_FLUSH' || c.hand === 'ROYAL_FLUSH'
    ).length;
    out.push(`Flushes on the board right now: ${n}`);
  }
  if (baseId === 'no-straights-x1_25') {
    const n = ctxs.filter(
      c =>
        c.hand === 'STRAIGHT' ||
        c.hand === 'STRAIGHT_FLUSH' ||
        c.hand === 'ROYAL_FLUSH'
    ).length;
    out.push(`Straights on the board right now: ${n}`);
  }
  if (baseId === 'rainbow-corners-x1_25') {
    const corners = [0, 4, 20, 24]
      .map(i => state.grid[i])
      .filter((c): c is NonNullable<typeof c> => c !== null);
    const suits = new Set(
      corners.filter(c => !isJoker(c)).map(c => (isJoker(c) ? '' : c.suit))
    );
    out.push(
      `Corners filled: ${corners.length} of 4 · distinct suits: ${suits.size}`
    );
  }
  if (baseId === 'patience-no-penalty') {
    const open = ctxs.filter(c => c.cards.some(x => x === null)).length;
    out.push(`Open lines right now: ${open} (−25 each at game end without this)`);
  }
  if (baseId.startsWith('hand-') && card.lineEffect) {
    // Name the hand the card pays for, with the live count below via
    // the generic firing line — but the count in the hand's own words
    // reads better, so use it directly.
    const firing = countFiring(card, ctxs);
    const hand = ctxs.find(c => {
      const e = card.lineEffect!(c, card, ctxs);
      return (e.multiplier ?? 1) !== 1 || (e.flatAdd ?? 0) !== 0;
    })?.hand;
    out.push(
      firing > 0 && hand
        ? `Lines scoring ${HAND_LABEL[hand]} right now: ${firing}`
        : 'No line scores this hand yet'
    );
    return out; // generic line would repeat the same number
  }

  // ---- generic engine-derived status ----

  if (card.lineEffect) {
    const firing = countFiring(card, ctxs);
    out.push(
      firing > 0
        ? `Firing on ${firing} line${firing === 1 ? '' : 's'} right now`
        : 'Not firing on any line yet'
    );
  }

  if (card.gridEffect) {
    const snap: GridSnapshot = {
      grid: state.grid,
      deckRemaining: state.deck.length,
      discards: state.discards,
      perkSpent: state.perkSpent,
      lines: ctxs,
    };
    const eff = card.gridEffect(snap, card);
    const m = eff.totalMultiplier ?? 1;
    const f = eff.totalFlatAdd ?? 0;
    out.push(
      m !== 1 || f !== 0
        ? `If the game ended now: ×${trimMult(m)}${f !== 0 ? ` +${f}` : ''}`
        : 'Not active yet'
    );
  }

  return out;
};

const countFiring = (card: BonusCard, ctxs: LineContext[]): number =>
  ctxs.filter(ctx => {
    const e = card.lineEffect!(ctx, card, ctxs);
    return (e.multiplier ?? 1) !== 1 || (e.flatAdd ?? 0) !== 0;
  }).length;
