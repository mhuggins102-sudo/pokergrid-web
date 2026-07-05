import {
  baseId,
  BonusCard,
  GridSnapshot,
  LineContext,
  isPlaceholder,
  isSpecialCard,
} from '../../game/bonusCards';
import { Suit, isJoker } from '../../game/cards';
import { lines as gridLines } from '../../game/grid';
import { evaluateLine } from '../../game/hands';
import { bonusShapleyValues } from '../../game/scoring';
import { GameState } from '../../game/state';
import { HAND_LABEL, lineLabel } from './handLabels';

export interface LiveContextOptions {
  // True when the popup is shown after the game is over (result /
  // archive views). In that state the "not yet" / "not active" lines
  // are meaningless, so they're suppressed, and the live Shapley line
  // is omitted because the end-game chip already shows the final
  // per-card contribution.
  final?: boolean;
}

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
  state: GameState,
  opts: LiveContextOptions = {}
): string[] => {
  if (isPlaceholder(card) || isSpecialCard(card)) return [];

  const final = opts.final ?? false;
  const base = baseId(card);
  const out: string[] = [];

  const ctxs: LineContext[] = gridLines(state.grid).map(l => ({
    kind: l.kind,
    index: l.index,
    cards: l.cards,
    hand: evaluateLine(l.cards),
  }));

  // ---- live Shapley contribution (gameplay only) ----
  // What this card is worth on the current board, fairly split when
  // several bonuses stack on the same line. Mirrors live preview
  // scoring (incomplete-line penalty ignored). Only shown when above 0.
  if (!final) {
    const idx = state.bonusCards.indexOf(card);
    if (idx >= 0) {
      const sh = bonusShapleyValues(state.grid, state.bonusCards, {
        deckRemaining: state.deck.length,
        discards: state.discards,
        perkSpent: state.perkSpent,
        ignoreIncompletePenalty: true,
      })[idx];
      if (sh !== undefined && sh > 0) {
        out.push(`Contributing +${sh} pts right now`);
      }
    }
  }

  // ---- targeted counters ----

  if (base === 'burnout-x1_25' || base === 'frugal-x1_5') {
    out.push(
      final
        ? `Suit perks spent: ${state.perkSpent.length}`
        : `Suit perks spent so far: ${state.perkSpent.length}`
    );
  }
  if (base === 'deck-bank-x1_05') {
    out.push(
      final
        ? `Deck cards left at the end: ${state.deck.length}`
        : `Deck cards remaining: ${state.deck.length}`
    );
  }
  if (base === 'trash-joker-x1_25') {
    const n = state.discards.filter(isJoker).length;
    out.push(final ? `Jokers destroyed: ${n}` : `Jokers destroyed so far: ${n}`);
  }
  if (base === 'cozy-joker-x1_15' || base === 'joker-line-x1_5') {
    out.push(
      `Jokers on the board: ${state.grid.filter(c => c !== null && isJoker(c)).length}`
    );
  }
  if (base.startsWith('suit-density-')) {
    const tail = base.slice('suit-density-'.length).toUpperCase();
    if (tail === 'H' || tail === 'S' || tail === 'D' || tail === 'C') {
      const suit = tail as Suit;
      const n = state.grid.filter(
        c => c !== null && !isJoker(c) && c.suit === suit
      ).length;
      out.push(`${SUIT_GLYPH[suit]} ${SUIT_NAME[suit]} on the board: ${n}`);
    }
  }
  if (base === 'diversity-x1_25') {
    const types = new Set(
      ctxs.map(c => c.hand).filter(h => h !== null && h !== 'HIGH_CARD')
    );
    out.push(
      final
        ? `Distinct scoring hand types: ${types.size} (needs 6+)`
        : `Distinct scoring hand types right now: ${types.size} (needs 6+)`
    );
  }
  if (base === 'balance-x1_25') {
    const missing = ctxs.filter(
      c => c.hand === null || c.hand === 'HIGH_CARD'
    );
    const ok = ctxs.length - missing.length;
    // In-game, naming the lines still below Pair is the actionable bit.
    const where =
      !final && missing.length > 0 ? ` (missing ${labelList(missing)})` : '';
    out.push(`Lines at Pair or better: ${ok} of 10${where}`);
  }
  if (base === 'no-flushes-x1_25') {
    const offenders = ctxs.filter(
      c =>
        c.hand === 'FLUSH' || c.hand === 'STRAIGHT_FLUSH' || c.hand === 'ROYAL_FLUSH'
    );
    const where = offenders.length > 0 ? ` (${labelList(offenders)})` : '';
    out.push(
      final
        ? `Flushes on the board: ${offenders.length}${where}`
        : `Flushes on the board right now: ${offenders.length}${where}`
    );
  }
  if (base === 'no-straights-x1_25') {
    const offenders = ctxs.filter(
      c =>
        c.hand === 'STRAIGHT' ||
        c.hand === 'STRAIGHT_FLUSH' ||
        c.hand === 'ROYAL_FLUSH'
    );
    const where = offenders.length > 0 ? ` (${labelList(offenders)})` : '';
    out.push(
      final
        ? `Straights on the board: ${offenders.length}${where}`
        : `Straights on the board right now: ${offenders.length}${where}`
    );
  }
  if (base === 'rainbow-corners-x1_25') {
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
  if (base === 'patience-no-penalty') {
    const open = ctxs.filter(c => c.cards.some(x => x === null));
    const where = open.length > 0 ? ` (${labelList(open)})` : '';
    out.push(
      final
        ? `Open lines: ${open.length}${where} — penalty waived`
        : `Open lines right now: ${open.length}${where} (−25 each at game end without this)`
    );
  }
  if (base.startsWith('hand-') && card.lineEffect) {
    // Name the hand the card pays for AND the specific lines scoring it.
    const firing = firingLines(card, ctxs);
    const hand = firing[0]?.hand;
    if (firing.length > 0 && hand) {
      out.push(
        `${final ? 'Scored' : 'Scoring'} ${HAND_LABEL[hand]} on ${labelList(firing)}`
      );
    } else if (!final) {
      out.push('No line scores this hand yet');
    }
    return out; // generic line would repeat the same information
  }

  // ---- generic engine-derived status ----

  if (card.lineEffect) {
    const firing = firingLines(card, ctxs);
    if (firing.length > 0) {
      out.push(`${final ? 'Fired' : 'Firing'} on ${labelList(firing)}`);
    } else if (!final) {
      out.push('Not firing on any line yet');
    }
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
    if (m !== 1 || f !== 0) {
      const payout = `×${trimMult(m)}${f !== 0 ? ` +${f}` : ''}`;
      out.push(final ? `Paid out: ${payout}` : `If the game ended now: ${payout}`);
    } else if (!final) {
      out.push('Not active yet');
    }
  }

  return out;
};

// Lines where the card's lineEffect fires, in R1→R5, C1→C5 order.
const firingLines = (card: BonusCard, ctxs: LineContext[]): LineContext[] =>
  ctxs.filter(ctx => {
    const e = card.lineEffect!(ctx, card, ctxs);
    return (e.multiplier ?? 1) !== 1 || (e.flatAdd ?? 0) !== 0;
  });

// "R2, C4" — compact labels for a set of lines.
const labelList = (ctxs: LineContext[]): string =>
  ctxs.map(c => lineLabel(c.kind, c.index)).join(', ');
