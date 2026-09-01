/**
 * The PokerGrid bot — a skilled, HONEST computer player.
 *
 * Plays complete games through the real reducer (newGame/step), so it
 * obeys exactly the rules the player does. Its information set is also
 * the player's: it sees the grid, its bonus hand, the discard pile, the
 * drawn card, and the REMAINING DECK AS A MULTISET (perfect card
 * counting — derivable from what's on screen), but never the deck's
 * ORDER and never what the bonus deck will offer next.
 *
 * Decision rule — determinized Monte Carlo projection:
 *   On every decision the bot enumerates each legal alternative
 *   (place / discard / the drawn suit's perk with every target, or
 *   which bonus card to keep), and for each one projects the run to
 *   its end by dealing out a SHUFFLED copy of the remaining cards
 *   ("always place" from here on), scoring the projected final grid
 *   with the full end-of-run rules (incomplete-line penalty included).
 *   Projections average over `samples` shuffles, and the same shuffles
 *   are reused for every candidate at one decision point (common
 *   random numbers — paired comparison kills most of the variance).
 *
 *   PLACE is the default: a discard or perk must beat the place
 *   projection by ACT_MARGIN to be chosen. Without the bar, sampling
 *   noise across dozens of candidates makes the argmax a winner's-
 *   curse machine — the bot burned perks and discards on phantom
 *   advantages and starved its own deck.
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
import { BONUS_HAND_LIMIT, BonusCard } from './bonusCards';
import { Card, activeHalf, isJoker } from './cards';
import { seededRng, shuffle } from './deck';
import { Direction, Grid, isFull, placeAtSpiralNext } from './grid';
import { Difficulty } from './rules';
import { ScoreReport, scoreGrid } from './scoring';
import { Action, GameState, newGame, step } from './state';

/** Shuffles per decision. Fixed so a run's bot score is reproducible
 *  everywhere; raising it makes the bot stronger and slower. */
export const BOT_DEFAULT_SAMPLES = 32;

/** How many projected points a discard or perk must beat plain
 *  placement by before the bot spends it. The bar absorbs residual
 *  sampling noise (winner's curse over many candidates) and prices in
 *  that every spent card shrinks the deck. Tuned against the sim: 15
 *  suppressed too many genuinely good perk plays (the paired-sample
 *  noise at 32 shuffles is well under that); 8 keeps the discipline
 *  without benching the perks. */
const ACT_MARGIN = 8;

/** Candidate shortlisting: rank all targets on this many shared
 *  orderings first… */
const STAGE1_ORDERINGS = 3;
/** …then re-score only the leaders on the full sample set. */
const SHORTLIST = 4;

/** A held bonus card whose removal costs at most this many projected
 *  points is dead weight — worth spending a ♣ at the cap to swap out
 *  (Easy/Medium), since replacing a do-nothing card is pure upside. */
const DEAD_CARD_EPS = 3;

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

// Canonical multiset key: two decks with the same cards in different
// orders sort identically, so everything downstream of the sort can
// only see WHAT remains, never in what order. Jokers sort last;
// supercharges (Targets Up carry-overs) keep distinct identities.
// Double Duty duals are not keyed — the bot doesn't play that twist.
const cardKey = (c: Card): string =>
  c.kind === 'joker' ? '~JK' : `${c.rank}${c.suit}${c.supercharge ?? ''}`;

// One decision point's evaluation context: K shuffled orderings of the
// remaining deck's SORTED multiset, shared by every candidate evaluated
// at this decision (common random numbers).
interface EvalCtx {
  s: GameState;
  orderings: Card[][];
}

const decisionCtx = (
  s: GameState,
  rng: () => number,
  samples: number
): EvalCtx => {
  const sorted = [...s.deck].sort((a, b) => {
    const ka = cardKey(a);
    const kb = cardKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return {
    s,
    orderings: Array.from({ length: samples }, () => shuffle(sorted, rng)),
  };
};

// Place every card from `deck` onto `start` in sequence until the deck
// is empty or the grid is full — the grid the run would end on if the
// bot just placed everything from this point forward.
const projectFill = (
  start: Grid,
  deck: ReadonlyArray<Card>
): { grid: Grid; deckRem: number } => {
  let g = start;
  let i = 0;
  while (i < deck.length && !isFull(g)) {
    g = placeAtSpiralNext(g, deck[i]);
    i++;
  }
  return { grid: g, deckRem: deck.length - i };
};

// Per-candidate knobs: a discard candidate's pile includes the drawn
// card, a perk candidate marks it spent (Patience / Frugal-style bonus
// cards read those piles), and shortlisting swaps in fewer orderings.
interface EvalOpts {
  discards?: ReadonlyArray<Card>;
  perkSpent?: ReadonlyArray<Card>;
  orderings?: Card[][];
}

// Mean projected end-of-run score for a candidate (grid, bonus hand)
// across the decision's shuffled orderings, scored with the FULL final
// rules (incomplete-line penalty included) so grid achievements and
// stranded-slot costs are priced in.
const projectScore = (
  candidateGrid: Grid,
  candidateBonusCards: ReadonlyArray<BonusCard>,
  ctx: EvalCtx,
  opts: EvalOpts = {}
): number => {
  const orderings = opts.orderings ?? ctx.orderings;
  const discards = opts.discards ?? ctx.s.discards;
  const perkSpent = opts.perkSpent ?? ctx.s.perkSpent;
  let sum = 0;
  for (const ordering of orderings) {
    const { grid, deckRem } = projectFill(candidateGrid, ordering);
    sum += scoreGrid(grid, candidateBonusCards, {
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
  return sum / orderings.length;
};

// Two-stage argmax over perk targets: rank everything on a couple of
// shared orderings, then re-score only the leaders on the full set.
// Cuts the projection count by ~5× on wide decisions (slides) with no
// measurable strength cost — the cheap pass only has to keep the true
// best inside the shortlist, not order it.
const bestCandidate = <T>(
  items: readonly T[],
  gridOf: (t: T) => Grid,
  ctx: EvalCtx,
  opts: EvalOpts
): { item: T; score: number } | null => {
  if (items.length === 0) return null;
  let pool: readonly T[] = items;
  if (items.length > SHORTLIST + 2) {
    const cheap = ctx.orderings.slice(0, STAGE1_ORDERINGS);
    pool = [...items]
      .map(item => ({
        item,
        sc: projectScore(gridOf(item), ctx.s.bonusCards, ctx, {
          ...opts,
          orderings: cheap,
        }),
      }))
      .sort((a, b) => b.sc - a.sc)
      .slice(0, SHORTLIST)
      .map(x => x.item);
  }
  let best: { item: T; score: number } | null = null;
  for (const item of pool) {
    const score = projectScore(gridOf(item), ctx.s.bonusCards, ctx, opts);
    if (best === null || score > best.score) best = { item, score };
  }
  return best;
};

const bestHop = (
  ctx: EvalCtx,
  opts: EvalOpts
): { score: number; i: number; j: number } | null => {
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
  return found
    ? { score: found.score, i: found.item[0], j: found.item[1] }
    : null;
};

interface SlideMove {
  from: number;
  direction: Direction;
  distance: number;
}

const bestSlide = (
  ctx: EvalCtx,
  opts: EvalOpts
): (SlideMove & { score: number }) | null => {
  const moves: SlideMove[] = validSlideSources(ctx.s.grid).flatMap(from =>
    slideDestinationsFrom(ctx.s.grid, from)
  );
  const found = bestCandidate(
    moves,
    m => executeSlide(ctx.s.grid, m.from, m.direction, m.distance),
    ctx,
    opts
  );
  return found ? { ...found.item, score: found.score } : null;
};

const bestDestroy = (
  ctx: EvalCtx,
  opts: EvalOpts
): { score: number; slot: number } | null => {
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
  return found ? { score: found.score, slot: found.item } : null;
};

// Cards still in the deck minus empty slots left to fill. ≥ 0 means the
// grid can still be refilled after this turn — the safety floor for
// actions that leave slots empty (discard, destroy), so the bot doesn't
// strand itself into the -25/line penalty.
const deckHeadroom = (s: GameState): number => {
  const empty = s.grid.filter(c => c === null).length;
  return s.deck.length - empty;
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

        // ♣ → take the bonus draw if we can. Below the cap it's a free
        // upgrade in expectation; the pick step below decides which
        // offered card to keep once the offer is visible.
        if (drawn.suit === 'C' && s.bonusDeck.length > 0) {
          if (s.bonusCards.length < BONUS_HAND_LIMIT) {
            planned = null;
            return { type: 'BEGIN_SUIT_ACTION' };
          }
          // AT the cap, Easy/Medium still allow taking ♣ to swap a held
          // card out. The offer is hidden, so gate on what we can see:
          // if the least-valuable held card contributes ~nothing to the
          // projection, swapping it is pure upside (bonus cards never
          // score negative) — even Medium's forced swap risks at most
          // the dead card's sliver. Otherwise keep the hand.
          if (s.bonusSwapAtCap !== 'off') {
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
        }

        const ctx = decisionCtx(s, rng, samples);

        // PLACE is the default; challengers must clear the margin.
        const placedGrid = placeAtSpiralNext(s.grid, drawn);
        const placeScore = projectScore(placedGrid, s.bonusCards, ctx);

        let bestAction: Action = { type: 'PLACE' };
        let bestScore = placeScore + ACT_MARGIN;
        planned = null;

        // DISCARD — only when discards are legal AND we won't strand
        // the grid. Headroom ≥ 2 leaves room for one more bad draw.
        if (!s.noDiscards && deckHeadroom(s) >= 2) {
          const discardScore = projectScore(s.grid, s.bonusCards, ctx, {
            discards: [...s.discards, activeHalf(drawn)],
          });
          if (discardScore > bestScore) {
            bestAction = { type: 'DISCARD_NONE' };
            bestScore = discardScore;
          }
        }

        // Suit perks — best outcome of the drawn card's perk only (the
        // player can only spend the drawn suit this turn). Spending
        // marks the card in perkSpent for the candidate's projection.
        const spent: EvalOpts = {
          perkSpent: [...s.perkSpent, activeHalf(drawn)],
        };
        if (drawn.suit === 'H') {
          const hop = bestHop(ctx, spent);
          if (hop && hop.score > bestScore) {
            bestAction = { type: 'BEGIN_SUIT_ACTION' };
            bestScore = hop.score;
            planned = { kind: 'hop', i: hop.i, j: hop.j };
          }
        } else if (drawn.suit === 'S') {
          const slide = bestSlide(ctx, spent);
          if (slide && slide.score > bestScore) {
            bestAction = { type: 'BEGIN_SUIT_ACTION' };
            bestScore = slide.score;
            planned = {
              kind: 'slide',
              move: {
                from: slide.from,
                direction: slide.direction,
                distance: slide.distance,
              },
            };
          }
        } else if (drawn.suit === 'D') {
          // Destroy leaves a slot empty — only when we can refill.
          if (deckHeadroom(s) >= 1) {
            const destroy = bestDestroy(ctx, spent);
            if (destroy && destroy.score > bestScore) {
              bestAction = { type: 'BEGIN_SUIT_ACTION' };
              bestScore = destroy.score;
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
        if (s.bonusCards.length < BONUS_HAND_LIMIT) {
          let bestIdx = 0;
          let bestSc = -Infinity;
          for (let i = 0; i < drawn.length; i++) {
            const hypothetical = [...s.bonusCards, drawn[i]];
            const sc = projectScore(s.grid, hypothetical, ctx);
            if (sc > bestSc) {
              bestSc = sc;
              bestIdx = i;
            }
          }
          return { type: 'BONUS_KEEP', idx: bestIdx };
        }
        // At the cap the kept card must REPLACE a held one, so value
        // each offer by its best single replacement; when declining is
        // allowed (Easy) and no replacement beats the current hand,
        // walk away instead.
        const current = projectScore(s.grid, s.bonusCards, ctx);
        let bestIdx = 0;
        let bestSc = -Infinity;
        for (let i = 0; i < drawn.length; i++) {
          for (let j = 0; j < s.bonusCards.length; j++) {
            const hand = s.bonusCards.slice();
            hand[j] = drawn[i];
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
          const hand = s.bonusCards.slice();
          hand[i] = newCard;
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
