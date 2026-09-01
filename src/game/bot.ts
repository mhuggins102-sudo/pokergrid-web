/**
 * The PokerGrid bot — a skilled, HONEST computer player.
 *
 * Plays complete games through the real reducer (newGame/step), so it
 * obeys exactly the rules the player does. Its information set is also
 * the player's: it sees the grid, its bonus hand, the discard pile, the
 * drawn card, and the REMAINING DECK AS A MULTISET (perfect card
 * counting — derivable from what's on screen), but never the deck's
 * ORDER and never what the bonus deck will offer next. It never uses
 * UNDO (which would reveal the next card) and never reaches for
 * reducer-only shortcuts the UI doesn't expose.
 *
 * Decision rule — determinized Monte Carlo projection:
 *   On every decision the bot enumerates each legal alternative (place
 *   / discard / the drawn suit's perk with every target, or which
 *   bonus card to keep) and projects each one to the end of the run by
 *   dealing a SHUFFLED copy of the remaining cards to a ROLLOUT PLAYER,
 *   then scoring the projected final grid with the full end-of-run
 *   rules (incomplete-line penalty included).
 *
 *   The rollout player is the heart of the evaluator. It is a
 *   competent, slack-aware selector: for every dealt card it scores
 *   the card's FIT at the next spiral slot — how much the card raises
 *   the made-hand value and draw potential of the slot's row and
 *   column, weighted by the held hand-type / row / column bonus
 *   multipliers — and discards cards whose fit falls below a bar that
 *   rises with the spare cards per open slot. It never discards when
 *   the deck can no longer refill the grid, so deck exhaustion (and
 *   the -25/line it costs) is priced into every projection.
 *
 *   Projections average over `samples` shuffles, and the same shuffles
 *   are reused for every candidate at one decision point (common
 *   random numbers), so alternatives are compared PAIRED on identical
 *   futures. PLACE is the default: a discard or perk has to beat it by
 *   a margin scaled to the paired-difference standard error, which
 *   absorbs the winner's curse of picking the best of many noisy
 *   candidates without a blunt fixed bar.
 *
 *   Slack is accounted for on every non-placement action: a discard
 *   or perk costs one deck card, a destroy costs two (the card and the
 *   re-opened slot), and no action may leave fewer cards than empty
 *   slots — the bot cannot strand its own grid.
 *
 *   Honesty is enforced structurally: the evaluator canonically SORTS
 *   the remaining deck before shuffling, so its output depends only on
 *   the multiset — permuting the true deck order cannot change any
 *   decision (bot.test.ts pins this).
 *
 * Determinism: the bot's sampling rng is seeded (botSeed), so the same
 * (difficulty, seed, botSeed, samples) always replays the same game to
 * the same score — the "Bot Score" a player sees is stable.
 *
 * Scope: free-play rules end-to-end, plus the twist phases the sim
 * harness exercises (Nut Low calibration). Specialty phases that only
 * challenges reach bail out cleanly.
 */
import {
  destroyableSlots,
  executeSlide,
  slideDestinationsFrom,
  validHopSwaps,
  validSlideSources,
} from './actions';
import { BONUS_HAND_LIMIT, BonusCard, SPOTLIGHT_ID, baseId } from './bonusCards';
import { Card, Suit, activeHalf, isJoker, rankIndex } from './cards';
import { seededRng, shuffle } from './deck';
import {
  Direction,
  Grid,
  SPIRAL_ORDER,
  colOf,
  placeAtSpiralNext,
  rowOf,
} from './grid';
import { HAND_TIER, HandRank, evaluateLine } from './hands';
import { Difficulty } from './rules';
import { HAND_BASE_VALUE, ScoreReport, scoreGrid } from './scoring';
import { Action, GameState, newGame, step } from './state';

/** Shuffles per decision. Fixed so a run's bot score is reproducible
 *  everywhere; raising it makes the bot stronger and slower. */
export const BOT_DEFAULT_SAMPLES = 48;

/** A challenger (discard / perk) must beat PLACE by at least this many
 *  projected points, whatever the noise says — every spent card also
 *  shrinks the deck in ways the projection only partly sees. */
const MIN_MARGIN = 2;
/** …and by this many paired standard errors. With common random
 *  numbers the paired difference is far less noisy than either mean,
 *  so a real edge clears the bar while sampling flukes don't. */
const MARGIN_Z = 1.25;

/** Candidate shortlisting: how many heuristic-ranked perk targets get
 *  the full sampled projection. */
const SHORTLIST = 6;

/** A held bonus card whose removal costs at most this many projected
 *  points is dead weight — worth spending a ♣ at the cap to swap out
 *  (Easy/Medium), since replacing a do-nothing card is pure upside. On
 *  Hard/Extreme (slots are forever) an offer worth no more than this
 *  is declined to keep the slot open for a better ♣ later. */
const DEAD_CARD_EPS = 3;

/** How many hidden offers to sample when pricing a ♣ take. */
const OFFER_PAIR_SAMPLES = 4;

const MAX_STEPS = 600;

export interface BotOptions {
  /** Monte-Carlo shuffles per decision (default BOT_DEFAULT_SAMPLES). */
  samples?: number;
  /** Seed for the bot's private sampling rng (default derived). */
  botSeed?: number;
}

export interface BotRun {
  /** Final reducer state (phase 'game-over'). */
  state: GameState;
  /** Full end-of-run score report for the bot's finished grid. */
  report: ScoreReport;
  /** Every action taken, in order — replayable via step() from the
   *  same starting state (groundwork for a move-by-move viewer). */
  actions: Action[];
}

// ---------------------------------------------------------------------
// Rollout player — the heuristic future self every projection plays.
// ---------------------------------------------------------------------

const N_HANDS = 11;
const LINE_ROW = (slot: number) => rowOf(slot);
const LINE_COL = (slot: number) => 5 + colOf(slot);

/**
 * Per-line hand-type multipliers the held bonus cards imply, as a
 * 10×11 table (rows 0-4, then cols 0-4; HAND_TIER order). Only the
 * cards whose effect is a pure function of (line, hand type) are
 * modelled — hand boosts, row/col boosts, Crossroads, Outer Edge. The
 * rollout player uses it to weigh fits (with Pair ×4 held, pairing up
 * is worth 20 not 5); every other card is still scored EXACTLY by the
 * terminal scoreGrid, it just doesn't steer the rollout's picks.
 */
export const heuristicMults = (cards: readonly BonusCard[]): Float64Array => {
  const t = new Float64Array(10 * N_HANDS).fill(1);
  const scaleLine = (line: number, m: number) => {
    for (let h = 0; h < N_HANDS; h++) t[line * N_HANDS + h] *= m;
  };
  for (const bc of cards) {
    const id = baseId(bc.id);
    const m = bc.multValue ?? 1;
    let match: RegExpMatchArray | null;
    if ((match = /^hand-([a-z_]+)-x/.exec(id))) {
      const hand = match[1].toUpperCase() as HandRank;
      const tier = HAND_TIER[hand];
      if (tier === undefined) continue;
      for (let line = 0; line < 10; line++) t[line * N_HANDS + tier] *= m;
    } else if ((match = /^row-(\d)-x/.exec(id))) {
      scaleLine(parseInt(match[1], 10) - 1, m);
    } else if ((match = /^col-(\d)-x/.exec(id))) {
      scaleLine(5 + parseInt(match[1], 10) - 1, m);
    } else if (id === 'spiral-core-x1_5') {
      scaleLine(2, m);
      scaleLine(7, m);
    } else if (id === 'outer-edge-x1_25') {
      for (const line of [0, 4, 5, 9]) scaleLine(line, m);
    }
  }
  return t;
};

const NO_MULTS = heuristicMults([]);

// Draw odds the rollout player credits a partial line with, by cards
// in the line: a suited or straight-shaped triple/quad is worth a slice
// of the made hand. Deliberately conservative — a draw is only an
// option the future self may or may not get to fill.
const FLUSH_DRAW_P = [0, 0, 0, 0.06, 0.22];
const STRAIGHT_DRAW_P = [0, 0, 0, 0.04, 0.14];
// Pairing odds per open slot for a rank group of size m (1 = a lone
// card, 2 = a pair, 3 = trips): the chance one more copy lands in the
// line, times the step-up in made-hand value that copy would bring.
// Gives a card seeded into an empty line real worth — it is what
// later pairs form around — instead of reading as a zero-fit junk
// card the rollout would throw away.
const GROW_P = [0, 0.1, 0.1, 0.08, 0];

const SUIT_IDX: Record<Suit, number> = { H: 0, S: 1, C: 2, D: 3 };
const rankCnt = new Int8Array(15);
const suitCnt = new Int8Array(4);
const lineScratch: (Card | null)[] = [null, null, null, null, null];

const madeOf = (top: number, second: number): HandRank =>
  top >= 5
    ? 'FIVE_OF_A_KIND'
    : top === 4
      ? 'FOUR_OF_A_KIND'
      : top === 3 && second >= 2
        ? 'FULL_HOUSE'
        : top === 3
          ? 'THREE_OF_A_KIND'
          : top === 2 && second === 2
            ? 'TWO_PAIR'
            : top === 2
              ? 'PAIR'
              : 'HIGH_CARD';

/**
 * Heuristic worth of one line as it stands: the count-based made hand
 * so far (pairs / trips / boats / quads, jokers extending the largest
 * group) at its bonus-weighted value, plus what its rank groups and
 * suit / straight shapes are drawing to. Complete lines use the real
 * evaluator. Reads `lineScratch`.
 */
const lineHeur = (lineIdx: number, mults: Float64Array): number => {
  let k = 0;
  let jokers = 0;
  let std = 0;
  rankCnt.fill(0);
  suitCnt.fill(0);
  for (let i = 0; i < 5; i++) {
    const c = lineScratch[i];
    if (c === null) continue;
    k++;
    if (c.kind === 'joker') {
      jokers++;
      continue;
    }
    std++;
    rankCnt[rankIndex(c.rank)] += c.supercharge === 'double' ? 2 : 1;
    suitCnt[SUIT_IDX[c.suit]]++;
  }
  if (k === 0) return 0;
  const base = lineIdx * N_HANDS;
  if (k === 5) {
    const hand = evaluateLine(lineScratch);
    return hand ? HAND_BASE_VALUE[hand] * mults[base + HAND_TIER[hand]] : 0;
  }
  let top = 0;
  let second = 0;
  let distinct = 0;
  let lo = 99;
  let hi = 0;
  for (let r = 2; r <= 14; r++) {
    const c = rankCnt[r];
    if (c === 0) continue;
    distinct++;
    if (r < lo) lo = r;
    if (r > hi) hi = r;
    if (c > top) {
      second = top;
      top = c;
    } else if (c > second) {
      second = c;
    }
  }
  top += jokers;
  const made = madeOf(top, second);
  const madeValue = HAND_BASE_VALUE[made] * mults[base + HAND_TIER[made]];
  let v = madeValue;
  const open = 5 - k;
  // Growth potential of the two biggest rank groups: one more copy of
  // the top group, or of the runner-up (a second pair / the boat).
  if (top >= 1 && top <= 3) {
    const up = madeOf(top + 1, second);
    v +=
      GROW_P[top] *
      open *
      Math.max(0, HAND_BASE_VALUE[up] * mults[base + HAND_TIER[up]] - madeValue);
  }
  if (second >= 1 && second <= 2 && open > 0) {
    const up = madeOf(top, second + 1);
    v +=
      GROW_P[second] *
      open *
      Math.max(0, HAND_BASE_VALUE[up] * mults[base + HAND_TIER[up]] - madeValue);
  }
  if (k >= 3 && std >= 2) {
    // Flush draw: every standard card shares a suit (jokers are wild).
    let maxSuit = 0;
    for (let s = 0; s < 4; s++) if (suitCnt[s] > maxSuit) maxSuit = suitCnt[s];
    if (maxSuit === std) {
      v += HAND_BASE_VALUE.FLUSH * mults[base + HAND_TIER.FLUSH] * FLUSH_DRAW_P[k];
    }
    // Straight draw: no pairs and the ranks fit a 5-wide window (ace
    // high or, if the rest sit at the bottom, low).
    if (distinct === std) {
      let straightOpen = hi - lo <= 4;
      if (!straightOpen && hi === 14) {
        let hi2 = 0;
        for (let r = 2; r <= 13; r++) if (rankCnt[r] > 0) hi2 = r;
        straightOpen = hi2 <= 5;
      }
      if (straightOpen) {
        v +=
          HAND_BASE_VALUE.STRAIGHT *
          mults[base + HAND_TIER.STRAIGHT] *
          STRAIGHT_DRAW_P[k];
      }
    }
  }
  return v;
};

const loadLine = (g: Grid, lineIdx: number): void => {
  if (lineIdx < 5) {
    const r0 = lineIdx * 5;
    for (let i = 0; i < 5; i++) lineScratch[i] = g[r0 + i];
  } else {
    const c0 = lineIdx - 5;
    for (let i = 0; i < 5; i++) lineScratch[i] = g[c0 + 5 * i];
  }
};

/**
 * How much `card` improves its row and column if it lands at `slot`:
 * the heuristic line values with the card minus without. Exported for
 * the rollout-policy tests.
 */
export const fitAt = (
  g: Grid,
  slot: number,
  card: Card,
  mults: Float64Array = NO_MULTS
): number => {
  const row = LINE_ROW(slot);
  const col = LINE_COL(slot);
  loadLine(g, row);
  const rowBefore = lineHeur(row, mults);
  lineScratch[colOf(slot)] = card;
  const rowAfter = lineHeur(row, mults);
  loadLine(g, col);
  const colBefore = lineHeur(col, mults);
  lineScratch[rowOf(slot)] = card;
  const colAfter = lineHeur(col, mults);
  return rowAfter - rowBefore + (colAfter - colBefore);
};

/** Heuristic worth of a whole board — the sum of its ten line values.
 *  Cheap and deterministic, so it ranks perk targets before the
 *  sampled projection is spent on the leaders. */
export const gridHeur = (g: Grid, mults: Float64Array = NO_MULTS): number => {
  let v = 0;
  for (let line = 0; line < 10; line++) {
    loadLine(g, line);
    v += lineHeur(line, mults);
  }
  return v;
};

/** Rollout selectivity knobs. */
export interface RolloutPolicy {
  /** Whether the future self may discard at all (false under
   *  lowball, where the fit heuristic inverts). */
  skip: boolean;
  /** Points of fit demanded per unit of (spare cards ÷ open slots).
   *  Higher = pickier future self. */
  scale: number;
  /** Bonus-weighted hand multipliers for the fit heuristic. */
  mults: Float64Array;
}

/** The fit bar for a dealt card given the slack left: spare cards per
 *  open slot, capped — beyond two spares per slot extra depth buys
 *  little more selectivity. */
const skipBar = (spare: number, open: number, scale: number): number =>
  scale * Math.min(spare / open, 2);

/**
 * Deal `ordering` onto `start` in spiral order until the grid is full
 * or the cards run out — the board the run would end on from here.
 * The rollout player discards a dealt card whose fit at the next slot
 * falls under the slack-scaled bar, but only while MORE cards remain
 * than empty slots (a discard can never strand the grid); jokers
 * always place (the reducer auto-places them). Exported for the
 * rollout-policy tests; the bot calls it through projectScore.
 */
export const projectFill = (
  start: Grid,
  ordering: ReadonlyArray<Card>,
  policy: RolloutPolicy
): { grid: Grid; deckRem: number } => {
  const g = start.slice();
  const slots: number[] = [];
  for (const slot of SPIRAL_ORDER) {
    if (g[slot] === null) slots.push(slot);
  }
  let si = 0;
  let i = 0;
  while (si < slots.length && i < ordering.length) {
    const card = ordering[i];
    const open = slots.length - si;
    // Cards left AFTER this one, beyond what the open slots need.
    const spare = ordering.length - i - 1 - open;
    if (
      policy.skip &&
      spare >= 0 &&
      card.kind === 'standard' &&
      fitAt(g, slots[si], card, policy.mults) <
        skipBar(spare + 1, open, policy.scale)
    ) {
      i++; // rollout discard — slack pays for a better card later
      continue;
    }
    g[slots[si]] = card;
    si++;
    i++;
  }
  return { grid: g, deckRem: ordering.length - i };
};

// ---------------------------------------------------------------------
// Projection — candidate boards scored over shared shuffled futures.
// ---------------------------------------------------------------------

// Canonical multiset key: two decks with the same cards in different
// orders sort identically, so everything downstream of the sort can
// only see WHAT remains, never in what order. Jokers sort last;
// supercharges (Targets Up carry-overs) keep distinct identities.
// Double Duty duals are not keyed — the bot doesn't play that twist.
const cardKey = (c: Card): string =>
  c.kind === 'joker' ? '~JK' : `${c.rank}${c.suit}${c.supercharge ?? ''}`;

/** Rollout pickiness: points of fit per spare-card-per-slot. Low on
 *  purpose — the rollout mostly passes on cards that HURT a line's
 *  outlook; a demanding bar made the projected future self too
 *  choosy, which overvalued slack and had the bot discarding where a
 *  perk or a placement scored more (fixed-seed benchmark). */
const ROLLOUT_SCALE = 1;

// One decision point's evaluation context: K shuffled orderings of the
// remaining deck's SORTED multiset, shared by every candidate evaluated
// at this decision (common random numbers), plus the rollout policy.
interface EvalCtx {
  s: GameState;
  orderings: Card[][];
  policy: RolloutPolicy;
}

const decisionCtx = (
  s: GameState,
  rng: () => number,
  samples: number,
  bonusCards: readonly BonusCard[] = s.bonusCards
): EvalCtx => {
  const sorted = [...s.deck].sort((a, b) => {
    const ka = cardKey(a);
    const kb = cardKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return {
    s,
    orderings: Array.from({ length: samples }, () => shuffle(sorted, rng)),
    policy: policyFor(s, bonusCards),
  };
};

// Slack-aware rollouts only where the real future self could also
// pass on a card; lowball keeps the plain fill (its junk logic
// inverts — pairing up is the bad outcome there). Under no-discard
// rules the future self can still spend a card on its perk instead of
// placing it, so the rollout keeps its pickiness there too.
const policyFor = (
  s: GameState,
  bonusCards: readonly BonusCard[]
): RolloutPolicy => ({
  skip: !s.lowball,
  scale: ROLLOUT_SCALE,
  mults: heuristicMults(bonusCards),
});

// Per-candidate knobs: a discard candidate's pile includes the drawn
// card, a perk candidate marks it spent (Patience / Frugal-style bonus
// cards read those piles), and shortlisting swaps in fewer orderings.
interface EvalOpts {
  discards?: ReadonlyArray<Card>;
  perkSpent?: ReadonlyArray<Card>;
  orderings?: Card[][];
}

// Projected end-of-run score for a candidate (grid, bonus hand) on
// EACH of the decision's shuffled orderings, scored with the FULL
// final rules (incomplete-line penalty included) so grid achievements
// and stranded-slot costs are priced in. Index k of every candidate's
// vector shares ordering k — paired comparison.
const projectVec = (
  candidateGrid: Grid,
  candidateBonusCards: ReadonlyArray<BonusCard>,
  ctx: EvalCtx,
  opts: EvalOpts = {}
): Float64Array => {
  const orderings = opts.orderings ?? ctx.orderings;
  const discards = opts.discards ?? ctx.s.discards;
  const perkSpent = opts.perkSpent ?? ctx.s.perkSpent;
  // A different hand than the context's means different fit weights.
  const policy =
    candidateBonusCards === ctx.s.bonusCards
      ? ctx.policy
      : { ...ctx.policy, mults: heuristicMults(candidateBonusCards) };
  const out = new Float64Array(orderings.length);
  for (let k = 0; k < orderings.length; k++) {
    const { grid, deckRem } = projectFill(candidateGrid, orderings[k], policy);
    out[k] = scoreGrid(grid, candidateBonusCards, {
      deckRemaining: deckRem,
      ignoreIncompletePenalty: false,
      discards,
      perkSpent,
      handBoost: ctx.s.handBoost,
      // Nut Low calibration runs: the argmax objective IS the lowball
      // total, so the bot needs no strategy change.
      lowball: ctx.s.lowball,
    }).total;
  }
  return out;
};

const mean = (v: Float64Array): number => {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i];
  return v.length > 0 ? sum / v.length : -Infinity;
};

const projectScore = (
  candidateGrid: Grid,
  candidateBonusCards: ReadonlyArray<BonusCard>,
  ctx: EvalCtx,
  opts: EvalOpts = {}
): number => mean(projectVec(candidateGrid, candidateBonusCards, ctx, opts));

/**
 * Does the challenger's projection beat the baseline's by a margin
 * the paired noise can't explain? Both vectors share orderings, so
 * the per-ordering difference is the statistic; its standard error
 * (over K samples) scales the bar, with a floor that prices the
 * spent card itself.
 */
const beats = (
  challenger: Float64Array,
  baseline: Float64Array,
  extraMargin = 0
): boolean => {
  const n = challenger.length;
  if (n === 0) return false;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const d = challenger[i] - baseline[i];
    sum += d;
    sumSq += d * d;
  }
  const avg = sum / n;
  const variance = n > 1 ? Math.max(0, sumSq / n - avg * avg) * (n / (n - 1)) : 0;
  const se = Math.sqrt(variance / n);
  return avg > Math.max(MIN_MARGIN, MARGIN_Z * se) + extraMargin;
};

// Argmax over perk targets in two stages: a deterministic heuristic
// pre-rank (the board's summed line worth — no sampling noise) keeps
// the plausible targets, then only those are projected on the full
// sample set. Ranking by projection on a handful of orderings was the
// old shortlist and it dropped the true best target most of the time
// on wide decisions; the heuristic can't see the future either, but
// it never confuses a good move with sampling luck.
const bestCandidate = <T>(
  items: readonly T[],
  gridOf: (t: T) => Grid,
  ctx: EvalCtx,
  opts: EvalOpts
): { item: T; vec: Float64Array } | null => {
  if (items.length === 0) return null;
  let pool: readonly T[] = items;
  if (items.length > SHORTLIST) {
    const mults = ctx.policy.mults;
    pool = [...items]
      .map(item => ({ item, sc: gridHeur(gridOf(item), mults) }))
      .sort((a, b) => b.sc - a.sc)
      .slice(0, SHORTLIST)
      .map(x => x.item);
  }
  let best: { item: T; vec: Float64Array; score: number } | null = null;
  for (const item of pool) {
    const vec = projectVec(gridOf(item), ctx.s.bonusCards, ctx, opts);
    const score = mean(vec);
    if (best === null || score > best.score) best = { item, vec, score };
  }
  return best;
};

const bestHop = (
  ctx: EvalCtx,
  opts: EvalOpts
): { vec: Float64Array; i: number; j: number } | null => {
  const found = bestCandidate(
    validHopSwaps(ctx.s.grid),
    ([i, j]) => {
      const g = ctx.s.grid.slice();
      [g[i], g[j]] = [g[j], g[i]];
      return g;
    },
    ctx,
    opts
  );
  return found ? { vec: found.vec, i: found.item[0], j: found.item[1] } : null;
};

interface SlideMove {
  from: number;
  direction: Direction;
  distance: number;
}

const bestSlide = (
  ctx: EvalCtx,
  opts: EvalOpts
): (SlideMove & { vec: Float64Array }) | null => {
  const moves: SlideMove[] = validSlideSources(ctx.s.grid).flatMap(from =>
    slideDestinationsFrom(ctx.s.grid, from)
  );
  const found = bestCandidate(
    moves,
    m => executeSlide(ctx.s.grid, m.from, m.direction, m.distance),
    ctx,
    opts
  );
  return found
    ? {
        from: found.item.from,
        direction: found.item.direction,
        distance: found.item.distance,
        vec: found.vec,
      }
    : null;
};

const bestDestroy = (
  ctx: EvalCtx,
  opts: EvalOpts
): { vec: Float64Array; slot: number } | null => {
  const found = bestCandidate(
    destroyableSlots(ctx.s.grid),
    slot => {
      const g = ctx.s.grid.slice();
      g[slot] = null;
      return g;
    },
    ctx,
    opts
  );
  return found ? { vec: found.vec, slot: found.item } : null;
};

// The hand the reducer would actually hold after taking `card`:
// Spotlight is exclusive (taking it evicts everything else; taking
// anything else evicts a held Spotlight) — mirrors enforceSpotlight
// in state.ts so hypotheticals never value an impossible hand.
const withCard = (
  hand: readonly BonusCard[],
  card: BonusCard,
  replaceIdx = -1
): BonusCard[] => {
  const next =
    replaceIdx >= 0
      ? hand.map((c, i) => (i === replaceIdx ? card : c))
      : [...hand, card];
  if (card.id === SPOTLIGHT_ID) return next.filter(c => c.id === SPOTLIGHT_ID);
  return next.filter(c => c.id !== SPOTLIGHT_ID || c === card);
};

// Cards still in the deck minus empty slots left to fill. Placing
// keeps it constant; every discard or perk spends one; a destroy
// spends two (its card and the re-opened slot). It must never go
// negative — that is a stranded grid and -25 per unfinished line.
const deckHeadroom = (s: GameState): number => {
  const empty = s.grid.filter(c => c === null).length;
  return s.deck.length - empty;
};

// Expected end-score of spending this ♣ on a below-cap bonus draw. The
// offer is hidden, so sample it honestly: the remaining offer deck's
// MULTISET is player-deducible (the pool is public and every offered
// card has been seen), its order is not — canonical-sort then shuffle
// with the bot's private rng, and evaluate a few pairs, crediting each
// pair's better card (the same argmax the resolving step really runs).
// Marginal value is projected JOINTLY with the held hand, so a card
// that fights the current hand (a kicker beside a full-house boost)
// prices low and the ♣ gets placed or discarded instead. Returns the
// per-ordering vector averaged across the sampled offers so it can be
// compared paired against PLACE.
const expectedBonusTake = (
  ctx: EvalCtx,
  rng: () => number,
  spent: EvalOpts
): Float64Array | null => {
  const s = ctx.s;
  const pool = shuffle(
    [...s.bonusDeck].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    ),
    rng
  );
  const acc = new Float64Array(ctx.orderings.length);
  let n = 0;
  for (let p = 0; p < pool.length && n < OFFER_PAIR_SAMPLES; p += 2) {
    const a = projectVec(s.grid, withCard(s.bonusCards, pool[p]), ctx, spent);
    let pick = a;
    if (p + 1 < pool.length) {
      const b = projectVec(s.grid, withCard(s.bonusCards, pool[p + 1]), ctx, spent);
      if (mean(b) > mean(a)) pick = b;
    }
    for (let k = 0; k < acc.length; k++) acc[k] += pick[k];
    n++;
  }
  if (n === 0) return null;
  for (let k = 0; k < acc.length; k++) acc[k] /= n;
  return acc;
};

// The move that justified a BEGIN_SUIT_ACTION, carried into the
// awaiting-target phase so the bot executes exactly what it ranked —
// no duplicate search, no fresh-sample second-guessing.
type PlannedMove =
  | { kind: 'hop'; i: number; j: number }
  | { kind: 'slide'; move: SlideMove }
  | { kind: 'destroy'; slot: number };

/**
 * A bot instance: a pickAction closure over a private seeded sampling
 * rng. Actions returned are always legal from the current phase; the
 * caller loops step(state, pickAction(state)) until game-over.
 */
export const createBot = (
  botSeed: number,
  samples: number = BOT_DEFAULT_SAMPLES
): { pickAction: (s: GameState) => Action } => {
  const rng = seededRng(botSeed);
  let planned: PlannedMove | null = null;

  const pickAction = (s: GameState): Action => {
    switch (s.phase.kind) {
      case 'awaiting-action': {
        const drawn = s.drawn;
        if (!drawn || isJoker(drawn)) return { type: 'PLACE' };
        const headroom = deckHeadroom(s);

        // ♣ AT the bonus cap: Easy/Medium still allow taking the draw
        // to swap a held card out. The offer is hidden, so gate on
        // what we can see: if the least-valuable held card contributes
        // ~nothing to the projection, swapping it is pure upside
        // (bonus cards never score negative) — even Medium's forced
        // swap risks at most the dead card's sliver.
        if (
          drawn.suit === 'C' &&
          s.bonusDeck.length > 0 &&
          s.bonusCards.length >= BONUS_HAND_LIMIT &&
          s.bonusSwapAtCap !== 'off' &&
          headroom >= 1
        ) {
          const capCtx = decisionCtx(s, rng, samples);
          const full = projectScore(s.grid, s.bonusCards, capCtx);
          let deadDelta = Infinity;
          for (let i = 0; i < s.bonusCards.length; i++) {
            const without = s.bonusCards.filter((_, j) => j !== i);
            deadDelta = Math.min(
              deadDelta,
              full - projectScore(s.grid, without, capCtx)
            );
          }
          if (deadDelta <= DEAD_CARD_EPS) {
            planned = null;
            return { type: 'BEGIN_SUIT_ACTION' };
          }
        }

        const ctx = decisionCtx(s, rng, samples);

        // PLACE is the default; challengers must clear the margin.
        const placedGrid = placeAtSpiralNext(s.grid, drawn);
        const placeVec = projectVec(placedGrid, s.bonusCards, ctx);

        let bestAction: Action = { type: 'PLACE' };
        let bestVec = placeVec;
        let bestIsPlace = true;
        planned = null;
        // A challenger must beat PLACE; a later challenger must beat
        // the standing best by the same rule.
        const consider = (vec: Float64Array | null, action: Action) => {
          if (!vec) return false;
          if (!beats(vec, placeVec)) return false;
          if (!bestIsPlace && !beats(vec, bestVec, -MIN_MARGIN)) return false;
          bestAction = action;
          bestVec = vec;
          bestIsPlace = false;
          return true;
        };

        // DISCARD — only when discards are legal AND the deck can still
        // refill the grid afterwards.
        if (!s.noDiscards && headroom >= 1) {
          const discardVec = projectVec(s.grid, s.bonusCards, ctx, {
            discards: [...s.discards, activeHalf(drawn)],
          });
          consider(discardVec, { type: 'DISCARD_NONE' });
        }

        // Suit perks — best outcome of the drawn card's perk only (the
        // player can only spend the drawn suit this turn). Spending
        // marks the card in perkSpent for the candidate's projection.
        // Every perk costs the drawn card, so the same refill floor
        // applies; a destroy also re-opens a slot and needs one more.
        const spent: EvalOpts = {
          perkSpent: [...s.perkSpent, activeHalf(drawn)],
        };
        if (headroom >= 1) {
          if (drawn.suit === 'C') {
            // Below-cap bonus draw: the sampled expected value of the
            // hidden offer must beat placing or discarding this ♣ like
            // any other candidate. Passing keeps the slot open for an
            // offer that fits the hand (slots are forever on
            // Hard/Extreme, no swap at cap).
            if (
              s.bonusDeck.length > 0 &&
              s.bonusCards.length < BONUS_HAND_LIMIT
            ) {
              consider(expectedBonusTake(ctx, rng, spent), {
                type: 'BEGIN_SUIT_ACTION',
              });
            }
          } else if (drawn.suit === 'H') {
            const hop = bestHop(ctx, spent);
            if (hop && consider(hop.vec, { type: 'BEGIN_SUIT_ACTION' })) {
              planned = { kind: 'hop', i: hop.i, j: hop.j };
            }
          } else if (drawn.suit === 'S') {
            const slide = bestSlide(ctx, spent);
            if (slide && consider(slide.vec, { type: 'BEGIN_SUIT_ACTION' })) {
              planned = {
                kind: 'slide',
                move: {
                  from: slide.from,
                  direction: slide.direction,
                  distance: slide.distance,
                },
              };
            }
          } else if (drawn.suit === 'D' && headroom >= 2) {
            const destroy = bestDestroy(ctx, spent);
            if (
              destroy &&
              consider(destroy.vec, { type: 'BEGIN_SUIT_ACTION' })
            ) {
              planned = { kind: 'destroy', slot: destroy.slot };
            }
          }
        }

        return bestAction;
      }
      case 'awaiting-target-hop': {
        if (planned?.kind === 'hop') {
          const { i, j } = planned;
          planned = null;
          return { type: 'RESOLVE_HOP', i, j };
        }
        // Fallback (no plan carried — e.g. a caller-driven state): the
        // grid is unchanged since BEGIN, so re-search and commit to the
        // best pair. Never cancel while a legal pair exists.
        const hop = bestHop(decisionCtx(s, rng, samples), {});
        if (!hop) return { type: 'CANCEL_ACTION' };
        return { type: 'RESOLVE_HOP', i: hop.i, j: hop.j };
      }
      case 'awaiting-target-slide-source': {
        if (planned?.kind === 'slide') {
          return { type: 'SLIDE_SELECT_SOURCE', slot: planned.move.from };
        }
        const slide = bestSlide(decisionCtx(s, rng, samples), {});
        if (!slide) return { type: 'CANCEL_ACTION' };
        planned = {
          kind: 'slide',
          move: {
            from: slide.from,
            direction: slide.direction,
            distance: slide.distance,
          },
        };
        return { type: 'SLIDE_SELECT_SOURCE', slot: slide.from };
      }
      case 'awaiting-target-slide-dest': {
        if (planned?.kind === 'slide' && planned.move.from === s.phase.source) {
          const { move } = planned;
          planned = null;
          return {
            type: 'RESOLVE_SLIDE',
            from: move.from,
            direction: move.direction,
            distance: move.distance,
          };
        }
        const from = s.phase.source;
        const moves = slideDestinationsFrom(s.grid, from);
        if (moves.length === 0) return { type: 'CANCEL_ACTION' };
        const ctx = decisionCtx(s, rng, samples);
        const found = bestCandidate(
          moves,
          m => executeSlide(s.grid, m.from, m.direction, m.distance),
          ctx,
          {}
        );
        const move = found?.item ?? moves[0];
        return {
          type: 'RESOLVE_SLIDE',
          from: move.from,
          direction: move.direction,
          distance: move.distance,
        };
      }
      case 'awaiting-target-destroy': {
        if (planned?.kind === 'destroy') {
          const { slot } = planned;
          planned = null;
          return { type: 'RESOLVE_DESTROY', slot };
        }
        const destroy = bestDestroy(decisionCtx(s, rng, samples), {});
        if (!destroy) return { type: 'CANCEL_ACTION' };
        return { type: 'RESOLVE_DESTROY', slot: destroy.slot };
      }
      case 'bonus-card-resolving': {
        // Keep whichever OFFERED card projects to the highest end
        // score — the offer is visible to the player too, so no
        // hidden information is consumed here.
        const drawn = s.phase.drawn;
        const ctx = decisionCtx(s, rng, samples);
        const current = projectScore(s.grid, s.bonusCards, ctx);
        if (s.bonusCards.length < BONUS_HAND_LIMIT) {
          let bestIdx = 0;
          let bestSc = -Infinity;
          for (let i = 0; i < drawn.length; i++) {
            const hypothetical = withCard(s.bonusCards, drawn[i]);
            const sc = projectScore(s.grid, hypothetical, ctx);
            if (sc > bestSc) {
              bestSc = sc;
              bestIdx = i;
            }
          }
          // Where a filled slot is forever (no swap at the cap) and
          // declining is allowed, a do-nothing offer isn't worth the
          // slot: pass and keep it open for a later ♣.
          if (
            s.difficulty !== 'easy' &&
            s.bonusSwapAtCap === 'off' &&
            bestSc - current <= DEAD_CARD_EPS
          ) {
            return { type: 'BONUS_DECLINE' };
          }
          return { type: 'BONUS_KEEP', idx: bestIdx };
        }
        // At the cap the kept card must REPLACE a held one, so value
        // each offer by its best single replacement; when declining is
        // allowed (Easy) and no replacement beats the current hand,
        // walk away instead.
        let bestIdx = 0;
        let bestSc = -Infinity;
        for (let i = 0; i < drawn.length; i++) {
          for (let j = 0; j < s.bonusCards.length; j++) {
            const hand = withCard(s.bonusCards, drawn[i], j);
            const sc = projectScore(s.grid, hand, ctx);
            if (sc > bestSc) {
              bestSc = sc;
              bestIdx = i;
            }
          }
        }
        if (s.bonusDeclineAllowed && bestSc <= current) {
          return { type: 'BONUS_DECLINE' };
        }
        return { type: 'BONUS_SELECT_NEW', idx: bestIdx };
      }
      case 'bonus-card-replacing': {
        // Replace the held card whose absence — once the new card
        // slots in — maximises the projected end score.
        const newCard = s.phase.drawn[s.phase.pickedNew];
        const ctx = decisionCtx(s, rng, samples);
        let bestIdx = 0;
        let bestSc = -Infinity;
        for (let i = 0; i < s.bonusCards.length; i++) {
          const hand = withCard(s.bonusCards, newCard, i);
          const sc = projectScore(s.grid, hand, ctx);
          if (sc > bestSc) {
            bestSc = sc;
            bestIdx = i;
          }
        }
        return { type: 'BONUS_REPLACE', oldIdx: bestIdx };
      }
      case 'awaiting-special-power-swap-source':
      case 'awaiting-special-power-swap-dest':
      case 'awaiting-special-doubler':
      case 'awaiting-special-wildcard':
      case 'awaiting-special-mega-destroy':
      case 'awaiting-special-side-slide-pick':
      case 'awaiting-special-side-slide-dest':
      case 'awaiting-special-jump-source':
      case 'awaiting-special-jump-dest':
      case 'awaiting-special-shuffle':
      case 'awaiting-special-plus-minus-target':
      case 'awaiting-special-plus-minus-direction':
      case 'awaiting-special-revive-pick':
      case 'awaiting-special-rewind':
      case 'awaiting-bonus-slot-choice':
      case 'awaiting-target-spiral':
        // Three Tricks / Mixed Bag / Spiraling specialty phases don't
        // appear in free play. If they ever do, bail out cleanly.
        return { type: 'CANCEL_ACTION' };
      case 'club-invest':
        // Bull Market's invest reveal — not a free-play phase.
        return { type: 'RESOLVE_CLUB_INVEST' };
      case 'draw-select': {
        // Five Draw (sim harness only): hold jokers and any paired
        // rank, redraw the rest ONCE — round two places immediately.
        const { hand, kept, draws } = s.phase;
        if (draws > 0) {
          for (let r = 0; r < 5; r++) {
            let empty = true;
            for (let c = 0; c < 5; c++) {
              if (s.grid[r * 5 + c] !== null) empty = false;
            }
            if (empty) return { type: 'PLACE_HAND_ROW', row: r };
          }
          throw new Error('round-two draw-select with no empty row');
        }
        const counts = new Map<string, number>();
        for (const c of hand) {
          if (!isJoker(c)) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
        }
        const wantKept = hand
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => isJoker(c) || (counts.get(c.rank) ?? 0) >= 2)
          .map(({ i }) => i);
        const keptSet = new Set(kept);
        const wantSet = new Set(wantKept);
        for (let i = 0; i < hand.length; i++) {
          if (keptSet.has(i) !== wantSet.has(i)) {
            return { type: 'TOGGLE_HAND_KEEP', idx: i };
          }
        }
        return { type: 'DRAW_REDRAW' };
      }
      case 'draw-place': {
        // Five Draw: first empty row, dealt order, then commit.
        const { hand, row, placed } = s.phase;
        if (row === null) {
          for (let r = 0; r < 5; r++) {
            let empty = true;
            for (let c = 0; c < 5; c++) {
              if (s.grid[r * 5 + c] !== null) empty = false;
            }
            if (empty) return { type: 'PLACE_HAND_ROW', row: r };
          }
          throw new Error('draw-place with no empty row');
        }
        const stagedIdx = new Set(placed.filter(p => p !== null));
        const idx = hand.map((_, i) => i).find(i => !stagedIdx.has(i));
        const openCol = placed.findIndex(p => p === null);
        if (idx !== undefined && openCol >= 0) {
          return { type: 'STAGE_HAND_CARD', idx, col: openCol };
        }
        return { type: 'RESOLVE_PLACE_HAND' };
      }
      case 'draw-bonus':
        // Five Draw's between-hands offer: pass — valuing a swap needs
        // board context the bot doesn't model.
        return { type: 'PASS_BONUS_CARD' };
      case 'game-over':
        throw new Error('pickAction called on game-over state');
    }
  };

  return { pickAction };
};

/**
 * Play a game to completion from an already-constructed state. Returns
 * the final state, its full score report, and the action trace.
 */
export const playBotGame = (
  initial: GameState,
  { samples = BOT_DEFAULT_SAMPLES, botSeed = 1 }: BotOptions = {}
): BotRun => {
  const bot = createBot(botSeed, samples);
  let s = initial;
  const actions: Action[] = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    if (s.phase.kind === 'game-over') break;
    const action = bot.pickAction(s);
    actions.push(action);
    s = step(s, action);
  }
  if (s.phase.kind !== 'game-over') {
    throw new Error(`bot stuck after ${MAX_STEPS} steps`);
  }
  const report = scoreGrid(s.grid, s.bonusCards, {
    deckRemaining: s.deck.length,
    discards: s.discards,
    perkSpent: s.perkSpent,
    handBoost: s.handBoost,
    lowball: s.lowball,
  });
  return { state: s, report, actions };
};

/**
 * Replay a FREE PLAY deal by (difficulty, seed) — the same
 * `newGame(difficulty, seededRng(seed))` construction the app's
 * GameSessionProvider uses, so the bot faces the exact deck the player
 * just did. The bot's own sampling seed derives from the game seed, so
 * the same run always reports the same bot score.
 */
export const runBotGame = (
  difficulty: Difficulty,
  seed: number,
  opts: BotOptions = {}
): BotRun => {
  const initial = newGame(difficulty, seededRng(seed));
  const botSeed = opts.botSeed ?? (seed ^ 0x9e3779b9) >>> 0;
  return playBotGame(initial, { ...opts, botSeed });
};
