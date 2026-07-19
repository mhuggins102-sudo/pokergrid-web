import {
  BonusCard,
  GridSnapshot,
  baseId,
  isPlaceholder,
  isSpecialCard,
} from '../../game/bonusCards';
import { HandRank, evaluatePartialLine } from '../../game/hands';
import { Grid } from '../../game/grid';
import { Card } from '../../game/cards';
import { ScoredLine, effectiveHandBase } from '../../game/scoring';
import { HAND_LABEL, lineLabel } from './handLabels';

/*
 * Pure, read-only line/bonus insight helpers behind the desktop Play
 * screen's hover model (design-refs/desktop/Play.dc.html). Nothing
 * here mutates or extends the engine — every function re-derives its
 * answer from the same lineEffect / gridEffect closures scoring runs.
 */

// -------------------------------------------------------------- //
// Per-card, per-line multiplier — including on INCOMPLETE lines. //
// -------------------------------------------------------------- //

// For an incomplete line, each effect is probed with the line's
// PARTIAL hand substituted in (evaluatePartialLine — 'HIGH_CARD' when
// the placed cards make nothing yet). Hand-independent multipliers
// (Crossroads, Royal Touch, densities, …) fire as before, and
// hand-keyed multipliers (Pair ×4) now light up while their hand is
// FORMING — the user-refined semantics over the mockup's GOLD
// registry. Effects only read LineContext fields (kind / index /
// cards / hand), so the synthetic substitution stays pure.

const isScoringCard = (card: BonusCard): boolean =>
  !isPlaceholder(card) && !isSpecialCard(card);

/** Multiplier this card currently applies on `line` — real effect for
 *  made lines, partial-hand probe for incomplete ones. */
export const cardLineMult = (
  card: BonusCard,
  line: ScoredLine,
  allLines: readonly ScoredLine[]
): number => {
  if (!card.lineEffect || !isScoringCard(card)) return 1;
  if (line.hand) {
    return card.lineEffect(line, card, allLines).multiplier ?? 1;
  }
  const partial = evaluatePartialLine(line.cards) ?? 'HIGH_CARD';
  return (
    card.lineEffect({ ...line, hand: partial }, card, allLines).multiplier ?? 1
  );
};

/** Product of every held in-game card's multiplier on `line`. */
export const lineGoldMult = (
  line: ScoredLine,
  cards: readonly BonusCard[],
  allLines: readonly ScoredLine[]
): number => cards.reduce((m, c) => m * cardLineMult(c, line, allLines), 1);

/** True when this in-game card's multiplier currently applies (>1)
 *  on the line — drives the hover attribution both ways. */
export const cardFiresOnLine = (
  card: BonusCard,
  line: ScoredLine,
  allLines: readonly ScoredLine[]
): boolean => cardLineMult(card, line, allLines) > 1;

// ------------------------------------------------------ //
// Edge-chip potential (the mockup's perLine, lines 647+). //
// ------------------------------------------------------ //

export type ChipTone =
  | 'gold' // made hand with a gold multiplier — solid warn pill
  | 'goldPotential' // FORMING hand a gold multiplier would boost — dashed warn
  | 'made'
  | 'potential'
  | 'wip'
  | 'none';

export interface LinePotential {
  /** Pill styling per the mockup: gold / made / potential / wip / none. */
  tone: ChipTone;
  /** Chip label: `+N` when something would score, `–` otherwise. */
  label: string;
  /** Tooltip / table hand name ('' for a fully empty line). */
  name: string;
  /** Effective gold multiplier when shown (>1), else 1. */
  mult: number;
  filled: number;
  /** The label's number: the made total, or what the forming hand would
   *  pay if the line completed as-is. 0 when nothing would score. */
  value: number;
}

export const linePotential = (
  line: ScoredLine,
  cards: readonly BonusCard[],
  allLines: readonly ScoredLine[],
  handBoost?: Partial<Record<HandRank, number>>
): LinePotential => {
  const filled = line.cards.filter(c => c !== null).length;
  if (filled === 0) {
    return { tone: 'none', label: '–', name: '', mult: 1, filled, value: 0 };
  }
  if (line.hand && line.hand !== 'HIGH_CARD') {
    const gold = line.multiplier > 1;
    return {
      tone: gold ? 'gold' : 'made',
      label: line.total > 0 ? `+${line.total}` : '–',
      name: HAND_LABEL[line.hand],
      mult: gold ? line.multiplier : 1,
      filled,
      value: line.total > 0 ? line.total : 0,
    };
  }
  if (line.hand === 'HIGH_CARD') {
    return { tone: 'none', label: '–', name: 'High Card', mult: 1, filled, value: 0 };
  }
  // Incomplete: what the current partial hand would pay if the line
  // finished as-is, including every line multiplier the partial hand
  // already triggers (hand-keyed cards probe against it). A boosted
  // forming hand renders DASHED gold — dashed = forming, gold =
  // multiplied.
  const partial = evaluatePartialLine(line.cards);
  const m = lineGoldMult(line, cards, allLines);
  if (partial && partial !== 'HIGH_CARD') {
    const potential = Math.ceil(effectiveHandBase(partial, handBoost) * m);
    return {
      tone: m > 1 ? 'goldPotential' : 'potential',
      label: potential > 0 ? `+${potential}` : '–',
      name: HAND_LABEL[partial],
      mult: m > 1 ? m : 1,
      filled,
      value: potential > 0 ? potential : 0,
    };
  }
  return { tone: 'wip', label: '–', name: 'In Progress', mult: 1, filled, value: 0 };
};

// ------------------------------------------------------------- //
// Purple (end-game) progress — hover tags + popover status line. //
// ------------------------------------------------------------- //

export interface PurpleProgress {
  /** Line tags ("R1".."C5") the hover model lights for this card. */
  tags: ReadonlySet<string>;
  /** Popover status line ("7 / 10 lines Pair or better"). */
  label: string;
  /** True when the card's condition is currently met. */
  ok: boolean;
}

const trimMult = (m: number): string =>
  m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

const tagOf = (l: ScoredLine): string => lineLabel(l.kind, l.index);

const FLUSH_HANDS: ReadonlySet<HandRank | null> = new Set([
  'FLUSH',
  'STRAIGHT_FLUSH',
  'ROYAL_FLUSH',
]);
const STRAIGHT_HANDS: ReadonlySet<HandRank | null> = new Set([
  'STRAIGHT',
  'STRAIGHT_FLUSH',
  'ROYAL_FLUSH',
]);

export interface PurpleProgressInputs {
  grid: Grid;
  lines: readonly ScoredLine[];
  deckRemaining: number;
  discards: readonly Card[];
  perkSpent: readonly Card[];
}

/** Progress readout for an end-game (grid-effect) card; null for
 *  in-game / special / placeholder cards. Mirrors the mockup's
 *  purpleProgress for its four cards and degrades to the card's own
 *  gridEffect ("would pay ×N") for the rest of the catalog. */
export const purpleProgress = (
  card: BonusCard,
  inputs: PurpleProgressInputs
): PurpleProgress | null => {
  if (!isScoringCard(card) || card.lineEffect || !card.gridEffect) return null;
  const { lines } = inputs;
  const base = baseId(card);

  if (base === 'balance-x1_25') {
    const met = lines.filter(l => l.hand && l.hand !== 'HIGH_CARD');
    return {
      tags: new Set(met.map(tagOf)),
      label: `${met.length} / 10 lines Pair or better`,
      ok: met.length === 10,
    };
  }
  if (base === 'diversity-x1_25') {
    const seen = new Map<HandRank, string>();
    for (const l of lines) {
      if (l.hand && l.hand !== 'HIGH_CARD' && !seen.has(l.hand)) {
        seen.set(l.hand, tagOf(l));
      }
    }
    return {
      tags: new Set(seen.values()),
      label: `${seen.size} / 6 distinct hand types`,
      ok: seen.size >= 6,
    };
  }
  if (base === 'no-flushes-x1_25' || base === 'no-straights-x1_25') {
    const straights = base === 'no-straights-x1_25';
    const offenders = lines.filter(l =>
      (straights ? STRAIGHT_HANDS : FLUSH_HANDS).has(l.hand)
    );
    const kind = straights ? 'straight' : 'flush';
    return {
      tags: new Set(offenders.map(tagOf)),
      label:
        offenders.length === 0
          ? `No ${kind}es yet — on track`
          : `${offenders.length} ${kind} line(s) — would break it`,
      ok: offenders.length === 0,
    };
  }
  if (base === 'deck-bank-x1_05') {
    return {
      tags: new Set(),
      label: `${inputs.deckRemaining} cards left in deck`,
      ok: true,
    };
  }

  // Rest of the purple catalog: report what the card's own gridEffect
  // would pay if the game ended now — no per-line attribution.
  const snap: GridSnapshot = {
    grid: inputs.grid,
    deckRemaining: inputs.deckRemaining,
    discards: inputs.discards,
    perkSpent: inputs.perkSpent,
    lines,
  };
  const eff = card.gridEffect(snap, card);
  const m = eff.totalMultiplier ?? 1;
  const f = eff.totalFlatAdd ?? 0;
  if (card.negatesIncompletePenalty) {
    const open = lines.filter(l => l.hand === null).length;
    return {
      tags: new Set(),
      label: `${open} open line(s) — penalty waived`,
      ok: true,
    };
  }
  if (m !== 1 || f !== 0) {
    return {
      tags: new Set(),
      label: `If the game ended now: ×${trimMult(m)}${f !== 0 ? ` +${f}` : ''}`,
      ok: true,
    };
  }
  return { tags: new Set(), label: 'Not active yet', ok: false };
};

/** SCORING-panel end-game rows: one per purple card currently firing
 *  (grid multiplier > 1, or a flat add). */
export interface EndgameRow {
  name: string;
  value: string; // "×1.25" / "+10" / "×1.25 +10"
}

export const endgameRows = (
  cards: readonly BonusCard[],
  inputs: PurpleProgressInputs
): EndgameRow[] => {
  const snap: GridSnapshot = {
    grid: inputs.grid,
    deckRemaining: inputs.deckRemaining,
    discards: inputs.discards,
    perkSpent: inputs.perkSpent,
    lines: inputs.lines,
  };
  const out: EndgameRow[] = [];
  for (const card of cards) {
    if (!isScoringCard(card) || !card.gridEffect) continue;
    const eff = card.gridEffect(snap, card);
    const m = eff.totalMultiplier ?? 1;
    const f = eff.totalFlatAdd ?? 0;
    if (m <= 1 && f === 0) continue;
    const parts: string[] = [];
    if (m !== 1) parts.push(`×${trimMult(m)}`);
    if (f !== 0) parts.push(`+${f}`);
    out.push({ name: card.title, value: parts.join(' ') });
  }
  return out;
};
