import { activeHalf, Card, isJoker, shiftRank, StandardCard, Suit } from './cards';
import {
  assignDualIdentities,
  freshShuffledDeck,
  rngStep,
  rngWordOf,
  shuffle,
} from './deck';
import {
  emptyGrid,
  Grid,
  isFull,
  nextSpiralSlot,
  placeAt,
  placeAtSpiralNext,
  randomEmptySlot,
} from './grid';
import { HandRank } from './hands';
import { clubInvestValue, pickInvestHand } from './invest';
import {
  baseId,
  BonusCard,
  BONUS_DECK_POOL,
  BONUS_HAND_LIMIT,
  cardMatchesSlot,
  isPlaceholder,
  isSpentSlot,
  isSpecialCard,
  SlotKind,
  slotPlaceholder,
  SPECIAL_DECK_POOL,
  SPOTLIGHT_ID,
} from './bonusCards';
import {
  BONUS_DECLINE_AT_CAP_BY_DIFFICULTY,
  BONUS_SWAP_AT_CAP_BY_DIFFICULTY,
  BonusSwapAtCap,
  CAN_PREVIEW_DECK_BY_DIFFICULTY,
  Difficulty,
  JOKERS_BY_DIFFICULTY,
  NO_DISCARDS_BY_DIFFICULTY,
  STARTER_BONUS_BY_DIFFICULTY,
  TARGET_BY_DIFFICULTY,
} from './rules';

// Re-exports for the few consumers that imported these from state.ts
// before the move. New code should import from ./rules directly.
export { STARTER_BONUS_BY_DIFFICULTY };
export const canPreviewDeck = (difficulty: Difficulty): boolean =>
  CAN_PREVIEW_DECK_BY_DIFFICULTY[difficulty];
import {
  canDeselectSideSlideSlot,
  canDrawBonus,
  canDestroy,
  canHop,
  canSlide,
  destroyableSlots,
  emptySlots,
  executeDestroy,
  executeHop,
  executeJump,
  executeMegaDestroy,
  executeRewind,
  executeShuffle,
  executeSideSlide,
  executeSlide,
  MEGA_DESTROY_MAX,
  occupiedSlots,
  REWIND_PICK_MAX,
  REWIND_PICK_MIN,
  SHUFFLE_PICK_MAX,
  SHUFFLE_PICK_MIN,
  sideSlideChainExtensions,
  sideSlideDestinationsForChain,
  SideSlideMove,
  SlideMove,
  slideDestinationsFrom,
  canSpin,
  spinDestination,
  spinnableSlots,
  supercharchableSlots,
  validHopSwaps,
  validSideSlideSources,
  validSlideSources,
} from './actions';
import { Direction } from './grid';

export type TargetReturnTo = 'awaiting-action';

export type Phase =
  | { kind: 'awaiting-action' }
  | { kind: 'awaiting-target-hop'; pairs: [number, number][]; returnTo: TargetReturnTo }
  | {
      kind: 'awaiting-target-slide-source';
      sources: number[];
      returnTo: TargetReturnTo;
    }
  | {
      kind: 'awaiting-target-slide-dest';
      source: number;
      moves: SlideMove[];
      returnTo: TargetReturnTo;
    }
  | { kind: 'awaiting-target-destroy'; targets: number[]; returnTo: TargetReturnTo }
  // Spin Cycle: ♠ rotates one card clockwise to the next empty cell on
  // its ring. Targets are the spinnable cards; the preview/confirm step
  // lives UI-side (usePhaseUI), the reducer only resolves the commit.
  | { kind: 'awaiting-target-spin'; targets: number[]; returnTo: TargetReturnTo }
  | {
      kind: 'bonus-card-resolving';
      drawn: BonusCard[]; // 1 or 2 cards
      // Categorized-slots (Mixed Bag) only: the slot the kept card
      // goes into. When set, BONUS_KEEP replaces bonusCards[targetSlot]
      // wholesale instead of pushing onto the end of the array.
      targetSlot?: number;
      returnTo: TargetReturnTo;
    }
  // Mixed Bag: ♣ first asks which slot to draw for. The player taps
  // a chip in the bonus strip (slot index 0/1/2). After picking, the
  // reducer draws from the bonus deck filtered to that slot's
  // category and transitions to bonus-card-resolving with
  // targetSlot set.
  | {
      kind: 'awaiting-bonus-slot-choice';
      returnTo: TargetReturnTo;
    }
  | {
      kind: 'bonus-card-replacing';
      drawn: BonusCard[];
      pickedNew: number; // index into drawn
      returnTo: TargetReturnTo;
    }
  // Bull Market challenge: the ♣ perk "invests" the drawn club's value
  // into a randomly-chosen hand type. This phase holds the result while
  // the spin wheel reveals it; RESOLVE_CLUB_INVEST applies the boost and
  // draws the next card.
  | {
      kind: 'club-invest';
      hand: HandRank;
      amount: number;
      returnTo: TargetReturnTo;
    }
  // Three Tricks challenge — special-card activation phases. `cardIdx`
  // points back into state.bonusCards so the handler can remove the
  // consumed card on commit. `slots` is the precomputed list of valid
  // grid targets (all occupied non-joker slots for doubler / wildcard,
  // all occupied slots for power-swap).
  | {
      kind: 'awaiting-special-power-swap-source';
      cardIdx: number;
      slots: number[];
      returnTo: TargetReturnTo;
    }
  | {
      kind: 'awaiting-special-power-swap-dest';
      cardIdx: number;
      source: number;
      slots: number[];
      returnTo: TargetReturnTo;
    }
  | {
      kind: 'awaiting-special-doubler';
      cardIdx: number;
      slots: number[];
      returnTo: TargetReturnTo;
    }
  | {
      kind: 'awaiting-special-wildcard';
      cardIdx: number;
      slots: number[];
      returnTo: TargetReturnTo;
    }
  // Mega Destroy is a multi-target phase: the player taps up to
  // MEGA_DESTROY_MAX cards in any order, toggles them in `selected`,
  // then confirms. The Confirm action is dispatched once the player
  // has at least one slot picked.
  | {
      kind: 'awaiting-special-mega-destroy';
      cardIdx: number;
      slots: number[];
      selected: number[];
      returnTo: TargetReturnTo;
    }
  // Side Slide is a two-step pick → dest flow modeled on ♠ Slide,
  // but the player builds the chain interactively. Pick starts with
  // the first tapped card; each subsequent tap either extends the
  // chain at one of its endpoints (orientation locks once 2+ cards
  // are picked) or removes an endpoint. Once the chain is 2+ cards
  // long the player commits to the dest phase to choose a landing.
  | {
      kind: 'awaiting-special-side-slide-pick';
      cardIdx: number;
      selected: number[];
      returnTo: TargetReturnTo;
    }
  | {
      kind: 'awaiting-special-side-slide-dest';
      cardIdx: number;
      chain: number[];
      moves: SideSlideMove[];
      // Path the player has tapped once. Stays set until they tap
      // a different destination (re-preview) or the same one again
      // (commit). null = no preview yet, first tap will set one.
      previewPath: Direction[] | null;
      returnTo: TargetReturnTo;
    }
  // Jump, Jump: pick any occupied card, then pick any empty slot.
  | {
      kind: 'awaiting-special-jump-source';
      cardIdx: number;
      sources: number[];
      returnTo: TargetReturnTo;
    }
  | {
      kind: 'awaiting-special-jump-dest';
      cardIdx: number;
      source: number;
      dests: number[];
      returnTo: TargetReturnTo;
    }
  // Shuffle: multi-select between SHUFFLE_PICK_MIN and SHUFFLE_PICK_MAX
  // cards (Confirm enables once at least MIN are picked, and the cap
  // blocks additional picks past MAX). Picked slots toggle off before
  // commit so the player can adjust.
  | {
      kind: 'awaiting-special-shuffle';
      cardIdx: number;
      slots: number[];
      selected: number[];
      returnTo: TargetReturnTo;
    }
  // Plus/Minus: pick any standard (non-joker) card on the grid; the
  // dest sub-phase shows +1 / −1 buttons that commit the rank shift.
  | {
      kind: 'awaiting-special-plus-minus-target';
      cardIdx: number;
      slots: number[];
      returnTo: TargetReturnTo;
    }
  | {
      kind: 'awaiting-special-plus-minus-direction';
      cardIdx: number;
      target: number;
      returnTo: TargetReturnTo;
    }
  // Revive: the picker is the discard pile (a list rendered in a
  // modal). The player taps a discarded card; the reducer pulls it
  // out of discards and places it at the next spiral slot.
  | {
      kind: 'awaiting-special-revive-pick';
      cardIdx: number;
      returnTo: TargetReturnTo;
    }
  // Rewind: multi-select 3-5 grid cards. Structurally mirrors
  // 'awaiting-special-shuffle'; the difference is in the commit
  // handler — Rewind removes the cards from the grid and mixes them
  // back into the playing deck rather than permuting in place.
  | {
      kind: 'awaiting-special-rewind';
      cardIdx: number;
      slots: number[];
      selected: number[];
      returnTo: TargetReturnTo;
    }
  | { kind: 'game-over' };

export interface GameState {
  deck: Card[];
  // Cards taken out of play without being spent on a suit perk: either
  // discarded by the player (Discard button) or destroyed by a ♦ on the
  // grid. The "Trash Joker" bonus card checks this pile.
  discards: Card[];
  // Drawn playing cards that the player spent on a suit perk (♥ Swap,
  // ♠ Slide, ♦ Destroy, ♣ Bonus). The Burnout / Frugal bonus cards check
  // this pile's length.
  perkSpent: Card[];
  bonusDeck: BonusCard[]; // depleting
  bonusCards: BonusCard[]; // held (max BONUS_HAND_LIMIT)
  grid: Grid;
  drawn: Card | null;
  difficulty: Difficulty;
  target: number;
  phase: Phase;
  history: string[];
  // Snapshot stack for UNDO. Each entry is the state immediately BEFORE a
  // commit action (PLACE, RESOLVE_*, BONUS_KEEP/REPLACE/DECLINE, DISCARD_NONE).
  // Snapshots store `past: []` so the stack stays flat.
  past: GameState[];
  // Number of UNDO actions executed this run. Result-screen reads this to
  // decide whether to count the run for stats; the GameScreen reads it to
  // enforce per-mode caps (challenges = 0, targets-up = 1, free = unlimited).
  undoCount: number;
  // True once the player has used BONUS_REPLACE to swap out a held bonus card
  // (only possible at the cap). The "No Swap" challenge checks this.
  swappedBonus: boolean;
  // True when the No Swap challenge is active. Disables ♣ entirely at the
  // bonus-hand cap so the player can't accidentally lose the run by drawing
  // a bonus with no choice but to swap.
  noSwap: boolean;
  // True when the No Discards challenge or Extreme difficulty is
  // active. Disables the Discard button entirely — every drawn card
  // must be placed or spent on a suit perk.
  noDiscards: boolean;
  // True when the player is allowed to decline a ♣ Bonus draw even at
  // the bonus-hand cap (skip the forced swap). Easy difficulty sets
  // this; Medium / Hard / Extreme leave it false.
  bonusDeclineAllowed: boolean;
  // How ♣ behaves at the bonus-hand cap: 'available' (Easy — swap or
  // decline), 'must' (Medium — forced swap), or 'off' (Hard / Extreme /
  // No Swap challenge — ♣ disabled entirely at the cap).
  bonusSwapAtCap: BonusSwapAtCap;
  // True when the Short Circuit challenge is active. The drawn card's
  // suit no longer determines which perk fires — instead, on
  // BEGIN_SUIT_ACTION the reducer picks a uniformly-random perk from
  // those currently available (hop / slide / destroy / bonus). The
  // drawn card is still spent in perkSpent.
  randomPerks: boolean;
  // True when the Spin Cycle challenge is active: ♠ rotates one card
  // clockwise to the next empty cell on its ring (inner 8 / outer 16;
  // the center cell is on neither) instead of sliding.
  spinCycle: boolean;
  // True when the Poker Purist challenge is active. The bonus deck
  // and hand both start empty and stay that way — no starter, no ♣
  // draws (canDrawBonus returns false against an empty bonusDeck),
  // and the UI hides the bonus card strip entirely. Scoring becomes
  // pure row + column poker math with no multiplier meta-layer.
  noBonusCards: boolean;
  // Mixed Bag challenge: lock each of the 3 hand slots to a category.
  // When set, bonusCards always has exactly 3 entries (length-fixed),
  // empty slots hold a placeholder card matching the slot's kind, and
  // ♣ draws are filtered to the slot's category. Undefined otherwise.
  slotCategories?: SlotKind[];
  // Scatter challenge: instead of the spiral, every card drawn from the
  // deck targets a uniformly-random empty slot, re-rolled for each new
  // drawn card (even after a suit perk spends the previous one). Jokers
  // auto-place at random slots too.
  scatter: boolean;
  // The random slot the current drawn card will land on under Scatter
  // (null otherwise / when nothing is drawn). Also drives the "next"
  // highlight in the UI.
  scatterSlot: number | null;
  // Bull Market challenge: the ♣ perk invests the drawn club's value
  // into a random hand type instead of drawing a bonus card.
  investHands: boolean;
  // Accumulated per-hand base-value boosts from invest perks.
  handBoost: Partial<Record<HandRank, number>>;
  // Double Duty challenge: every standard card carries a second identity
  // (dual); FLIP_CARD rotates the drawn card so the bottom half becomes
  // active, at the cost of burning the next TWO deck cards unseen.
  doubleDuty: boolean;
  // True once the current drawn card has been flipped — one flip per
  // card, no flip-back. Reset on every new draw.
  flippedDrawn: boolean;
  // Cards burned by FLIP_CARD, removed from the game sight-unseen. Kept
  // separate from `discards` on purpose: burned cards feed nothing —
  // not Trash Joker, not any other discard-counting effect.
  burned: Card[];
  // Double Duty: the UN-stripped two-way card auto-seated at game start,
  // so the opening flight can pose both halves in the well before the
  // grid shows the top half only. Null outside Double Duty; never
  // mutated after newGame.
  openingCard: Card | null;
  // Mulberry32 state word for every random call the reducer makes after
  // newGame (Scatter slots, Short Circuit perk picks, Bull Market invest
  // spins, Shuffle / Rewind specials). Owning the stream in state makes
  // step(state, action) pure — React may invoke a reducer more than once
  // per action, and UNDO snapshots rewind the stream along with the rest
  // of the state, so undo + redo replays the identical outcome instead
  // of granting a re-roll. Seeded from the setup rng's current word, so
  // a seeded (daily) run continues the exact stream the historical
  // shared-closure implementation produced.
  rngState: number;
}

export type Action =
  | { type: 'PLACE' }
  | { type: 'DISCARD_NONE' } // sends drawn to discards (no perk used)
  // Double Duty: rotate the drawn two-way card so its bottom half becomes
  // active; the next TWO deck cards are burned unseen as the cost.
  | { type: 'FLIP_CARD' }
  | { type: 'BEGIN_SUIT_ACTION'; forSuit?: Suit }
  | { type: 'RESOLVE_HOP'; i: number; j: number }
  | { type: 'SLIDE_SELECT_SOURCE'; slot: number }
  | { type: 'RESOLVE_SLIDE'; from: number; direction: Direction; distance: number }
  | { type: 'RESOLVE_DESTROY'; slot: number }
  // Spin Cycle: rotate the card at `slot` to its ring's next empty cell.
  | { type: 'RESOLVE_SPIN'; slot: number }
  | { type: 'BONUS_KEEP'; idx: number }
  | { type: 'BONUS_SELECT_NEW'; idx: number }
  | { type: 'BONUS_REPLACE'; oldIdx: number }
  | { type: 'BONUS_DECLINE' }
  // Back out of the "which held card to swap out?" step to the card-select
  // popup (so an easy-mode player can reach the decline option instead).
  | { type: 'BONUS_BACK' }
  // Mixed Bag: pick a slot to draw for after ♣ fires.
  | { type: 'BONUS_PICK_SLOT'; slot: number }
  // Bull Market: dismiss the invest wheel; applies the boost + draws next.
  | { type: 'RESOLVE_CLUB_INVEST' }
  | { type: 'CANCEL_ACTION' }
  // Three Tricks: activate a held special card. The current draw is NOT
  // spent — these are independent of the suit-perk flow.
  | { type: 'ACTIVATE_SPECIAL_CARD'; idx: number }
  | { type: 'RESOLVE_POWER_SWAP_SOURCE'; slot: number }
  | { type: 'RESOLVE_POWER_SWAP'; i: number; j: number }
  | { type: 'RESOLVE_DOUBLER'; slot: number }
  | { type: 'RESOLVE_WILDCARD'; slot: number }
  | { type: 'TOGGLE_MEGA_DESTROY_TARGET'; slot: number }
  | { type: 'RESOLVE_MEGA_DESTROY' }
  | { type: 'TOGGLE_SIDE_SLIDE_PICK'; slot: number }
  | { type: 'SIDE_SLIDE_DONE_PICKING' }
  | { type: 'SIDE_SLIDE_PREVIEW'; path: Direction[] | null }
  | { type: 'RESOLVE_SIDE_SLIDE'; path: Direction[] }
  | { type: 'RESOLVE_JUMP_SOURCE'; slot: number }
  | { type: 'RESOLVE_JUMP'; source: number; dest: number }
  | { type: 'TOGGLE_SHUFFLE_TARGET'; slot: number }
  | { type: 'RESOLVE_SHUFFLE' }
  | { type: 'RESOLVE_PLUS_MINUS_TARGET'; slot: number }
  | { type: 'RESOLVE_PLUS_MINUS'; delta: 1 | -1 }
  | { type: 'RESOLVE_REVIVE'; discardIdx: number }
  | { type: 'TOGGLE_REWIND_TARGET'; slot: number }
  | { type: 'RESOLVE_REWIND' }
  | { type: 'UNDO' };

const log = (s: GameState, msg: string): GameState => ({
  ...s,
  history: [...s.history, msg],
});

const drawNext = (
  state: GameState,
  rng: () => number = Math.random
): GameState => {
  let s = state;
  while (true) {
    if (isFull(s.grid)) {
      return { ...s, drawn: null, scatterSlot: null, phase: { kind: 'game-over' } };
    }
    if (s.deck.length === 0) {
      return { ...s, drawn: null, scatterSlot: null, phase: { kind: 'game-over' } };
    }
    const [next, ...rest] = s.deck;
    if (isJoker(next)) {
      // Scatter sends auto-placed jokers to random slots too; otherwise
      // they follow the spiral. randomEmptySlot is non-null here (grid
      // isn't full).
      const grid = s.scatter
        ? placeAt(s.grid, randomEmptySlot(s.grid, rng)!, next)
        : placeAtSpiralNext(s.grid, next);
      s = log({ ...s, deck: rest, grid }, 'Joker auto-placed');
      continue;
    }
    // Re-roll the random target for THIS drawn card (Scatter).
    const scatterSlot = s.scatter ? randomEmptySlot(s.grid, rng) : null;
    return {
      ...s,
      deck: rest,
      drawn: next,
      scatterSlot,
      flippedDrawn: false,
      phase: { kind: 'awaiting-action' },
    };
  }
};

// STARTER_BONUS_BY_DIFFICULTY + canPreviewDeck used to live here; they're
// now in src/game/rules.ts alongside every other per-difficulty knob so
// the engine, UI popups, and rules screen all read from one place.

// Everything a mode can configure beyond the difficulty. All optional —
// a plain Free Play run passes nothing.
export interface NewGameOptions {
  targetOverride?: number;
  // Cap the playing deck to this many cards (after shuffle, before the
  // first card is placed). Used by the Short Deck challenge to remove 8
  // random cards from circulation.
  deckLimit?: number;
  // Lock in No Swap rules — ♣ is unavailable at the bonus-hand cap.
  noSwap?: boolean;
  // Lock in No Discards rules — DISCARD_NONE is rejected by the
  // reducer; the Discard button hides in GameScreen.
  noDiscards?: boolean;
  // Targets-Up carry-over: cards the player kept from the previous level's
  // power-up pick, pre-placed in the starting hand. The free easy/medium
  // starter is drawn AROUND these so the same card type isn't duplicated.
  keptBonusCards?: BonusCard[];
  // Targets-Up carry-over: extra bonus cards (the two NOT kept from each
  // previous level, powered up) shuffled into this level's bonus deck.
  deckExtras?: BonusCard[];
  // Targets-Up S-tier reward: standard cards with a supercharge ('wild'
  // or 'double') the player earned in a previous level. We replace the
  // matching un-supercharged card in the fresh shuffled deck so the
  // supercharged version can be drawn in this level.
  superchargedDeckCards?: Card[];
  // Lock in Short Circuit rules — the drawn card's suit no longer
  // dictates which perk fires; instead BEGIN_SUIT_ACTION picks a
  // uniformly-random perk from those currently available.
  randomPerks?: boolean;
  // Lock in Spin Cycle rules — ♠ rotates a card around its ring
  // instead of sliding.
  spinCycle?: boolean;
  // Lock in Poker Purist rules — no bonus cards anywhere. Both the
  // starting hand and the bonus deck are emptied; ♣ becomes unavailable
  // (canDrawBonus → false against an empty deck) and the UI hides the
  // bonus card strip.
  noBonusCards?: boolean;
  // Three Tricks challenge: a fixed initial bonus hand that REPLACES
  // the normal starter draw. Combined with noBonusCards=true the player
  // starts with these specific cards (the three one-time specials) and
  // the bonus deck stays empty, so the ♣ perk can't draw anything.
  initialBonusCards?: BonusCard[];
  // Mixed Bag challenge: positionally-categorized slots. Slot N is
  // locked to slotCategories[N]'s category (placeholder card seeded at
  // start). ♣ draws are filtered by slot category. The bonus deck is
  // built from BONUS_DECK_POOL + SPECIAL_DECK_POOL so the green slot
  // has something to draw.
  slotCategories?: SlotKind[];
  // Gridlock challenge: pre-place N cards at random positions on the
  // grid before the spiral fill begins. The cards are pulled off the
  // top of the shuffled deck (so RNG drives both which cards and where
  // they land). 0 / undefined = standard spiral-from-center start.
  randomGridFill?: number;
  // Scatter challenge: every drawn card targets a random empty slot
  // (re-rolled per draw) instead of the spiral.
  scatter?: boolean;
  // Bull Market challenge: ♣ invests the drawn club's value into a
  // random hand type (paired with noBonusCards = true).
  investHands?: boolean;
  // Double Duty challenge: every standard card gets a dual (bottom-half)
  // identity — a derangement of the 52 ranks+suits — and FLIP_CARD
  // becomes available on the drawn card.
  doubleDuty?: boolean;
}

export const newGame = (
  difficulty: Difficulty,
  rng: () => number = Math.random,
  options: NewGameOptions = {}
): GameState => {
  const {
    targetOverride,
    deckLimit,
    noSwap = false,
    noDiscards = false,
    keptBonusCards = [],
    deckExtras = [],
    superchargedDeckCards = [],
    randomPerks = false,
    spinCycle = false,
    noBonusCards = false,
    initialBonusCards = [],
    slotCategories,
    randomGridFill = 0,
    scatter = false,
    investHands = false,
    doubleDuty = false,
  } = options;
  // Joker count is determined by difficulty (Easy ships 2 jokers, Hard
  // ships 1, Extreme ships 0). Targets-Up infers difficulty from level
  // and Challenges always use Hard, so this single lookup covers every
  // mode without per-mode special casing.
  const jokerCount = JOKERS_BY_DIFFICULTY[difficulty];
  let deck = freshShuffledDeck(rng, jokerCount);
  // Double Duty: pair every standard card with a dual identity before any
  // card leaves the deck, so the pairing covers all 52 physical cards.
  if (doubleDuty) deck = assignDualIdentities(deck, rng);
  if (deckLimit !== undefined && deckLimit < deck.length) {
    deck = deck.slice(0, deckLimit);
  }
  // Splice supercharged cards into the freshly shuffled deck by replacing
  // the matching standard card (same rank + suit) in place. Position is
  // preserved so the player can't predict when a supercharged card draws.
  for (const sc of superchargedDeckCards) {
    if (sc.kind !== 'standard') continue;
    const idx = deck.findIndex(
      d => d.kind === 'standard' && d.rank === sc.rank && d.suit === sc.suit
    );
    if (idx >= 0) deck[idx] = sc;
  }
  // The free easy/medium starter must come from the un-powered pool AND
  // must not duplicate any card the player has already kept across levels
  // (per the user's "the second card should not be one of the other
  // superpowered cards" rule). Filter the standard pool to exclude held
  // base ids before drawing the starter.
  //
  // Also exclude any base ids that already exist in deckExtras as a
  // powered variant — the powered version REPLACES the original copy
  // in the deck rather than coexisting with it. Otherwise the player
  // could draw both an upgraded Royal Touch ×1.8 AND a fresh Royal
  // Touch ×1.5 in the same level.
  const heldBaseIds = new Set(keptBonusCards.map(baseId));
  const poweredBaseIds = new Set(deckExtras.map(baseId));
  const excludedBaseIds = new Set<string>([...heldBaseIds, ...poweredBaseIds]);
  // Joker-dependent bonus cards (Trash Joker, Cozy Joker, Joker Line)
  // can never trigger when the deck has no jokers — Extreme runs and
  // any future no-joker challenges. Strip them from the draw pool so
  // the player doesn't waste a ♣ pulling a dud.
  if (jokerCount === 0) {
    excludedBaseIds.add('trash-joker-x1_25');
    excludedBaseIds.add('cozy-joker-x1_15');
    excludedBaseIds.add('joker-line-x1_5');
  }
  const drawable = BONUS_DECK_POOL.filter(c => !excludedBaseIds.has(c.id));
  const shuffledBonus = shuffle(drawable, rng);
  // Poker Purist short-circuits the whole bonus setup — no starter
  // draw, no shuffled deck, no carry-overs. Hand and deck both stay
  // empty for the entire run. Three Tricks rides on top of this:
  // noBonusCards stays true (no draw deck, no ♣) but the assembled
  // hand is seeded with the three special action cards. Mixed Bag
  // (slotCategories) seeds positional placeholders so the slot
  // layout is fixed from turn 1.
  const starterCount = noBonusCards ? 0 : STARTER_BONUS_BY_DIFFICULTY[difficulty];
  // Player's hand starts with the kept carry-overs first, then the
  // difficulty-based free starter on top (capped at BONUS_HAND_LIMIT just
  // in case future power-ups push the carry to 3 cards on hard).
  const starterDraw = noBonusCards ? [] : shuffledBonus.slice(0, starterCount);
  const assembledHand = slotCategories
    ? slotCategories.map(kind => slotPlaceholder(kind))
    : noBonusCards
    ? initialBonusCards.slice(0, BONUS_HAND_LIMIT)
    : [...keptBonusCards, ...starterDraw].slice(0, BONUS_HAND_LIMIT);
  // Apply Spotlight's exclusivity rule if the starter draw or a
  // carry-over brought Spotlight into the hand alongside anything
  // else. The starter is the "last added" entry by construction,
  // so it wins ties; if only carry-overs exist, the most recent
  // carry-over wins (no current path produces multiple carry-overs,
  // but we use the last entry as a safe fallback).
  const lastAdded =
    starterDraw[starterDraw.length - 1] ??
    keptBonusCards[keptBonusCards.length - 1];
  const bonusCards = lastAdded
    ? enforceSpotlight(assembledHand, lastAdded)
    : assembledHand;
  // Bonus deck = standard pool minus the drawn starter + powered carry-overs
  // from earlier levels. Shuffled together so the powered cards can resurface
  // at any time. Poker Purist leaves it empty so ♣ never has anything to draw.
  // Mixed Bag mixes the regular pool with the special deck so the green
  // slot has cards to draw — they're filtered by slot kind at draw time.
  const remainingPool = shuffledBonus.slice(starterCount);
  const bonusDeck = noBonusCards
    ? []
    : slotCategories
    ? shuffle([...remainingPool, ...deckExtras, ...SPECIAL_DECK_POOL], rng)
    : shuffle([...remainingPool, ...deckExtras], rng);
  // Gridlock: scatter the first N cards across random distinct grid
  // positions, then resume normal spiral fill on the remainder. The
  // standard start (center first, then spiral) is the N=0 case of
  // the same logic, treated as a special path so the existing
  // placeAtSpiralNext helper stays untouched.
  let grid: Grid;
  let rest: Card[];
  let openingCard: Card | null = null;
  if (randomGridFill > 0) {
    const initialCards = deck.slice(0, randomGridFill);
    rest = deck.slice(randomGridFill);
    // Random order over the 25 slot indices; first N positions seat
    // the initial cards. Uses the same rng so the run is fully
    // deterministic given the seed.
    const positions = shuffle(
      Array.from({ length: 25 }, (_, i) => i),
      rng
    ).slice(0, initialCards.length);
    const g = emptyGrid();
    for (let i = 0; i < initialCards.length; i++) {
      // activeHalf: grid cards never carry a dual (Double Duty strips it
      // wherever a card leaves the draw well). No-op in every other mode.
      g[positions[i]] = activeHalf(initialCards[i]);
    }
    grid = g;
  } else {
    const [first, ...remaining] = deck;
    rest = remaining;
    // Double Duty: remember the full two-way card so the opening flight
    // can show both halves before the grid seats the stripped top half.
    if (doubleDuty && first.kind === 'standard' && first.dual) {
      openingCard = first;
    }
    // Scatter seats even the very first card at a random slot instead of
    // the center; otherwise the spiral starts from the middle.
    grid = scatter
      ? placeAt(emptyGrid(), randomEmptySlot(emptyGrid(), rng)!, activeHalf(first))
      : placeAtSpiralNext(emptyGrid(), activeHalf(first));
  }
  const initial: GameState = {
    deck: rest,
    discards: [],
    perkSpent: [],
    bonusDeck,
    bonusCards,
    grid,
    drawn: null,
    difficulty,
    target: targetOverride ?? TARGET_BY_DIFFICULTY[difficulty],
    phase: { kind: 'awaiting-action' },
    history: ['Game start'],
    past: [],
    undoCount: 0,
    swappedBonus: false,
    noSwap,
    // Free Play / Targets-Up derive these from difficulty; Challenges
    // override via their own flags (No Discards → true regardless of
    // difficulty; otherwise difficulty-based).
    noDiscards: noDiscards || NO_DISCARDS_BY_DIFFICULTY[difficulty],
    bonusDeclineAllowed: BONUS_DECLINE_AT_CAP_BY_DIFFICULTY[difficulty],
    // The No Swap challenge forces ♣ off at the cap regardless of the
    // difficulty's own rule (Hard / Extreme are already 'off').
    bonusSwapAtCap: noSwap ? 'off' : BONUS_SWAP_AT_CAP_BY_DIFFICULTY[difficulty],
    randomPerks,
    spinCycle,
    noBonusCards,
    slotCategories,
    scatter,
    scatterSlot: null,
    investHands,
    handBoost: {},
    doubleDuty,
    flippedDrawn: false,
    burned: [],
    openingCard,
    rngState: 0, // placeholder — captured from `rng` below, after setup
  };
  const started = drawNext(initial, rng);
  // Capture the rng's CURRENT word (after all setup consumption) so the
  // in-play stream continues exactly where the setup stream left off —
  // bit-identical to the old behavior of threading one shared closure
  // through every step() call, but now owned by the state (pure reducer).
  return { ...started, rngState: rngWordOf(rng) };
};

// ---------- helpers ----------

// Cards that go to the discards pile (no perk usage): the Discard button,
// and the target of a ♦ Destroy. The "Trash Joker" bonus card looks here.
const pushDiscard = (s: GameState, card: Card): GameState => ({
  ...s,
  discards: [...s.discards, card],
});

// Cards spent on a suit perk: the drawn ♥/♠/♦/♣ that triggered the perk.
// Burnout / Frugal look here. activeHalf keeps Double Duty duals out of
// the persisted pile (no-op elsewhere).
const pushPerkSpent = (s: GameState, card: Card): GameState => ({
  ...s,
  perkSpent: [...s.perkSpent, activeHalf(card)],
});

// ---------- action handlers ----------

const handlePlace = (s: GameState, rng: () => number): GameState => {
  if (s.phase.kind !== 'awaiting-action' || !s.drawn) return s;
  // Scatter lands the card on its pre-rolled random slot; otherwise the
  // spiral picks the next slot. If the pre-rolled slot has since been
  // occupied (no current mode can do that, but grid-moving effects and
  // Scatter are composed programmatically by the daily recipe), re-roll
  // rather than letting placeAt throw and take down the reducer.
  let slot =
    s.scatter && s.scatterSlot !== null
      ? s.scatterSlot
      : nextSpiralSlot(s.grid);
  if (slot !== null && s.grid[slot] !== null) {
    slot = s.scatter ? randomEmptySlot(s.grid, rng) : nextSpiralSlot(s.grid);
  }
  if (slot === null) return s;
  // activeHalf: a Double Duty card seats as its face-up identity only.
  // (Cards that later leave the grid — Rewind back to the deck, Revive
  // from discards — were stripped here and can never flip again; both
  // specials are unreachable in Double Duty anyway.)
  const grid = placeAt(s.grid, slot, activeHalf(s.drawn));
  return drawNext(log({ ...s, grid }, 'Place'), rng);
};

const handleDiscardNone = (s: GameState, rng: () => number): GameState => {
  if (s.phase.kind !== 'awaiting-action' || !s.drawn || isJoker(s.drawn)) return s;
  if (s.noDiscards) return s; // No Discards challenge — reject the action.
  return drawNext(log(pushDiscard(s, activeHalf(s.drawn)), 'Discard'), rng);
};

// Double Duty: rotate the drawn card 180° so its bottom half becomes the
// active identity. One flip per card (no flip-back), and the cost is
// burning the next TWO deck cards sight-unseen — they go to `burned`,
// feeding nothing (a burned joker does NOT count for Trash Joker). The
// history entry deliberately never names the burned cards.
const handleFlip = (s: GameState): GameState => {
  if (!s.doubleDuty || s.phase.kind !== 'awaiting-action') return s;
  const drawn = s.drawn;
  if (!drawn || isJoker(drawn) || !drawn.dual) return s; // jokers can't flip
  if (s.flippedDrawn) return s; // one flip per card
  if (s.deck.length < 2) return s; // needs two cards to burn
  const [burn1, burn2, ...rest] = s.deck;
  const flipped: StandardCard = {
    kind: 'standard',
    rank: drawn.dual.rank,
    suit: drawn.dual.suit,
    dual: { rank: drawn.rank, suit: drawn.suit },
    uid: drawn.uid,
    // supercharge deliberately not carried — it belongs to the printed
    // top half. Unreachable today (supercharges exist only in Targets-Up,
    // which never runs Double Duty), noted for safety.
  };
  return log(
    {
      ...s,
      deck: rest,
      drawn: flipped,
      flippedDrawn: true,
      burned: [...s.burned, activeHalf(burn1), activeHalf(burn2)],
    },
    'Flip (2 cards burned)'
  );
};

// Short Circuit: pick a uniformly-random suit whose perk would
// currently fire. The same availability gates that the suit switch
// below applies (canHop, canSlide, canDestroy, canDrawBonus + the
// noSwap cap rule for ♣) decide which suits are valid candidates,
// so the randomly-picked perk is guaranteed to actually run rather
// than no-op.
/**
 * Mixed Bag: can this slot take a ♣ draw? A spent one-time slot is gone
 * for the whole game, and under no-swap rules (Hard / Extreme / the No
 * Swap challenge — bonusSwapAtCap 'off') a slot holding a LIVE card is
 * committed for the run: Mixed Bag's per-slot draws are its version of
 * the swap, so no-swap games may only fill OPEN (placeholder) slots.
 */
export const slotDrawable = (s: GameState, slot: number): boolean => {
  const occupant = s.bonusCards[slot];
  if (isSpentSlot(occupant)) return false;
  if (
    s.bonusSwapAtCap === 'off' &&
    occupant !== undefined &&
    !isPlaceholder(occupant)
  ) {
    return false;
  }
  return true;
};

const pickRandomAvailablePerk = (s: GameState, rng: () => number): Suit | null => {
  const candidates: Suit[] = [];
  if (canHop(s.grid)) candidates.push('H');
  if (canSlide(s.grid)) candidates.push('S');
  if (canDestroy(s.grid)) candidates.push('D');
  if (
    canDrawBonus(s.bonusDeck.length) &&
    !(
      s.bonusSwapAtCap === 'off' &&
      !s.slotCategories &&
      s.bonusCards.length >= BONUS_HAND_LIMIT
    )
  ) {
    candidates.push('C');
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
};

const handleBeginSuitAction = (
  s: GameState,
  rng: () => number,
  forSuit?: Suit
): GameState => {
  if (s.phase.kind !== 'awaiting-action' || !s.drawn || isJoker(s.drawn)) return s;
  const drawn = s.drawn;
  // Decide which perk to fire:
  //   - `forSuit` (caller override) wins. Used by the wild-card perk
  //     chooser to let the player pick any suit perk when the drawn
  //     card's suit is flexible.
  //   - Otherwise Short Circuit picks a uniformly-random available
  //     perk (the engine's existing behavior).
  //   - Otherwise the drawn card's own suit determines the perk.
  // perkSpent still records the actual drawn card so Burnout /
  // Frugal stay correct regardless of which branch fires.
  const effectiveSuit: Suit = forSuit
    ?? (s.randomPerks
      ? pickRandomAvailablePerk(s, rng) ?? drawn.suit
      : drawn.suit);
  switch (effectiveSuit) {
    case 'H': {
      if (!canHop(s.grid)) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-target-hop',
          pairs: validHopSwaps(s.grid),
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'S': {
      // Spin Cycle: ♠ rotates one card around its ring instead of
      // sliding a chain.
      if (s.spinCycle) {
        if (!canSpin(s.grid)) return s;
        return {
          ...s,
          phase: {
            kind: 'awaiting-target-spin',
            targets: spinnableSlots(s.grid),
            returnTo: 'awaiting-action',
          },
        };
      }
      if (!canSlide(s.grid)) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-target-slide-source',
          sources: validSlideSources(s.grid),
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'D': {
      if (!canDestroy(s.grid)) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-target-destroy',
          targets: destroyableSlots(s.grid),
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'C': {
      // Bull Market: ♣ invests the drawn club's value into a random hand
      // type. Spin the wheel (in the new phase); RESOLVE applies it.
      if (s.investHands) {
        return {
          ...s,
          phase: {
            kind: 'club-invest',
            hand: pickInvestHand(rng),
            amount: clubInvestValue(drawn),
            returnTo: 'awaiting-action',
          },
        };
      }
      if (!canDrawBonus(s.bonusDeck.length)) return s;
      // Mixed Bag: ♣ first asks which slot to draw for. The deck is
      // filtered to that slot's category once the player picks (see
      // handleBonusPickSlot). Skip this branch if no slot category
      // has any drawable cards left. A slot whose one-time action has
      // been used is spent for the whole game, and under no-swap rules
      // a live card locks its slot (see slotDrawable) — neither counts
      // as drawable here. Mixed Bag runs its own per-slot swap
      // semantics, so it is NOT gated by the at-cap rule below.
      if (s.slotCategories) {
        const anySlotDrawable = s.slotCategories.some(
          (kind, i) =>
            slotDrawable(s, i) &&
            s.bonusDeck.some(c => cardMatchesSlot(c, kind))
        );
        if (!anySlotDrawable) return s;
        return {
          ...s,
          phase: { kind: 'awaiting-bonus-slot-choice', returnTo: 'awaiting-action' },
        };
      }
      // ♣ is disabled at the cap for Hard / Extreme and the No Swap
      // challenge (bonusSwapAtCap === 'off') — no draw, no forced swap.
      if (s.bonusSwapAtCap === 'off' && s.bonusCards.length >= BONUS_HAND_LIMIT) {
        return s;
      }
      // Draw up to 2 from the top of the bonus deck.
      const drawCount = Math.min(2, s.bonusDeck.length);
      const bonusDrawn = s.bonusDeck.slice(0, drawCount);
      const remainingDeck = s.bonusDeck.slice(drawCount);
      return {
        ...s,
        bonusDeck: remainingDeck,
        phase: {
          kind: 'bonus-card-resolving',
          drawn: bonusDrawn,
          returnTo: 'awaiting-action',
        },
      };
    }
  }
};

const handleResolveHop = (
  s: GameState,
  i: number,
  j: number,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'awaiting-target-hop') return s;
  if (!s.drawn || isJoker(s.drawn)) return s;
  const grid = executeHop(s.grid, i, j);
  return drawNext(log(pushPerkSpent({ ...s, grid }, s.drawn), `Hop ${i}↔${j}`), rng);
};

const handleSlideSelectSource = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-target-slide-source') return s;
  if (!s.grid[slot]) return s;
  const moves = slideDestinationsFrom(s.grid, slot);
  if (moves.length === 0) return s;
  return {
    ...s,
    phase: {
      kind: 'awaiting-target-slide-dest',
      source: slot,
      moves,
      returnTo: s.phase.returnTo,
    },
  };
};

const handleResolveSlide = (
  s: GameState,
  from: number,
  direction: Direction,
  distance: number,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'awaiting-target-slide-dest') return s;
  if (!s.drawn || isJoker(s.drawn)) return s;
  const valid = s.phase.moves.find(
    m => m.from === from && m.direction === direction && m.distance === distance
  );
  if (!valid) return s;
  const grid = executeSlide(s.grid, from, direction, distance);
  return drawNext(
    log(pushPerkSpent({ ...s, grid }, s.drawn), `Slide ${direction} × ${distance}`),
    rng
  );
};

const handleResolveSpin = (
  s: GameState,
  slot: number,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'awaiting-target-spin') return s;
  if (!s.drawn || isJoker(s.drawn)) return s;
  if (!s.phase.targets.includes(slot)) return s;
  const card = s.grid[slot];
  const dest = spinDestination(s.grid, slot);
  if (!card || dest === null) return s;
  const grid = s.grid.slice();
  grid[slot] = null;
  grid[dest] = card;
  return drawNext(
    log(pushPerkSpent({ ...s, grid }, s.drawn), `Spin ${slot} → ${dest}`),
    rng
  );
};

const handleResolveDestroy = (
  s: GameState,
  slot: number,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'awaiting-target-destroy') return s;
  if (!s.drawn || isJoker(s.drawn)) return s;
  const { grid, removed } = executeDestroy(s.grid, slot);
  // Target goes to discards (not a perk usage — collateral); the diamond
  // itself goes to perkSpent.
  const afterTarget = pushDiscard({ ...s, grid }, removed);
  return drawNext(
    log(pushPerkSpent(afterTarget, s.drawn), `Destroy slot ${slot}`),
    rng
  );
};

const handleResolveClubInvest = (
  s: GameState,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'club-invest' || !s.drawn || isJoker(s.drawn)) return s;
  const { hand, amount } = s.phase;
  const handBoost = {
    ...s.handBoost,
    [hand]: (s.handBoost[hand] ?? 0) + amount,
  };
  return drawNext(
    log(
      pushPerkSpent({ ...s, handBoost }, s.drawn),
      `Invest +${amount} into ${hand}`
    ),
    rng
  );
};

// ---------- special card handlers (Three Tricks challenge) ----------

// Mark the special card at `cardIdx` as spent. The card stays in the
// bonus hand so its slot stays occupied (preserves the chip layout and,
// for future modes, blocks ♣ from drawing a fresh card into that
// position). The chip rendering dims used cards and the Use button
// disappears from the detail modal.
const consumeSpecial = (s: GameState, cardIdx: number): BonusCard[] => {
  return s.bonusCards.map((c, i) =>
    i === cardIdx ? { ...c, used: true } : c
  );
};

const handleActivateSpecial = (s: GameState, idx: number): GameState => {
  if (s.phase.kind !== 'awaiting-action') return s;
  if (idx < 0 || idx >= s.bonusCards.length) return s;
  const card = s.bonusCards[idx];
  if (!isSpecialCard(card)) return s;
  // A spent card can't be re-activated. The UI hides the Use button
  // for used cards but the reducer enforces it too in case anything
  // else tries to fire one.
  if (card.used) return s;
  switch (card.specialKind) {
    case 'power-swap': {
      const slots = occupiedSlots(s.grid);
      // Need at least two cards on the grid to swap. With a partially
      // filled board this can theoretically fail; reject gracefully.
      if (slots.length < 2) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-power-swap-source',
          cardIdx: idx,
          slots,
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'doubler':
    case 'wildcard': {
      const slots = supercharchableSlots(s.grid);
      if (slots.length === 0) return s;
      return {
        ...s,
        phase: {
          kind:
            card.specialKind === 'doubler'
              ? 'awaiting-special-doubler'
              : 'awaiting-special-wildcard',
          cardIdx: idx,
          slots,
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'mega-destroy': {
      const slots = occupiedSlots(s.grid);
      if (slots.length === 0) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-mega-destroy',
          cardIdx: idx,
          slots,
          selected: [],
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'side-slide': {
      const sources = validSideSlideSources(s.grid);
      if (sources.length === 0) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-side-slide-pick',
          cardIdx: idx,
          selected: [],
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'jump': {
      // Need at least one occupied card AND one empty slot.
      const sources = occupiedSlots(s.grid);
      const empties = emptySlots(s.grid);
      if (sources.length === 0 || empties.length === 0) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-jump-source',
          cardIdx: idx,
          sources,
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'shuffle': {
      const slots = occupiedSlots(s.grid);
      // Need at least SHUFFLE_PICK_MIN cards on the grid to fire —
      // anything less can't form a meaningful permutation.
      if (slots.length < SHUFFLE_PICK_MIN) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-shuffle',
          cardIdx: idx,
          slots,
          selected: [],
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'plus-minus': {
      // Same target rules as Doubler / Wildcard — any non-joker
      // standard card. Jokers carry no rank so a rank shift would
      // be meaningless on them.
      const slots = supercharchableSlots(s.grid);
      if (slots.length === 0) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-plus-minus-target',
          cardIdx: idx,
          slots,
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'revive': {
      // Nothing to revive if the discard pile is empty. The grid
      // also needs to have room — if the grid is full (very late in
      // the run) the revived card has nowhere to land.
      if (s.discards.length === 0) return s;
      if (isFull(s.grid)) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-revive-pick',
          cardIdx: idx,
          returnTo: 'awaiting-action',
        },
      };
    }
    case 'rewind': {
      const slots = occupiedSlots(s.grid);
      // Need at least REWIND_PICK_MIN cards on the grid to fire.
      if (slots.length < REWIND_PICK_MIN) return s;
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-rewind',
          cardIdx: idx,
          slots,
          selected: [],
          returnTo: 'awaiting-action',
        },
      };
    }
  }
  return s;
};

const handlePowerSwapSource = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-power-swap-source') return s;
  if (!s.phase.slots.includes(slot)) return s;
  return {
    ...s,
    phase: {
      kind: 'awaiting-special-power-swap-dest',
      cardIdx: s.phase.cardIdx,
      source: slot,
      // Any other occupied slot is a valid dest.
      slots: s.phase.slots.filter(i => i !== slot),
      returnTo: s.phase.returnTo,
    },
  };
};

const handlePowerSwap = (s: GameState, i: number, j: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-power-swap-dest') return s;
  if (s.phase.source !== i && s.phase.source !== j) return s;
  const a = s.grid[i];
  const b = s.grid[j];
  if (!a || !b) return s;
  const grid = s.grid.slice();
  grid[i] = b;
  grid[j] = a;
  const newHand = consumeSpecial(s, s.phase.cardIdx);
  return log(
    { ...s, grid, bonusCards: newHand, phase: { kind: 'awaiting-action' } },
    `Power Swap ${i}↔${j}`
  );
};

const handleResolveDoubler = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-doubler') return s;
  if (!s.phase.slots.includes(slot)) return s;
  const card = s.grid[slot];
  if (!card || isJoker(card)) return s;
  const grid = s.grid.slice();
  // Re-supercharging replaces any prior supercharge (matches Targets Up
  // semantics — see cards.ts Supercharge comment).
  grid[slot] = { ...card, supercharge: 'double' };
  const newHand = consumeSpecial(s, s.phase.cardIdx);
  return log(
    { ...s, grid, bonusCards: newHand, phase: { kind: 'awaiting-action' } },
    `Doubler on slot ${slot}`
  );
};

const handleResolveWildcard = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-wildcard') return s;
  if (!s.phase.slots.includes(slot)) return s;
  const card = s.grid[slot];
  if (!card || isJoker(card)) return s;
  const grid = s.grid.slice();
  grid[slot] = { ...card, supercharge: 'wild' };
  const newHand = consumeSpecial(s, s.phase.cardIdx);
  return log(
    { ...s, grid, bonusCards: newHand, phase: { kind: 'awaiting-action' } },
    `Wildcard on slot ${slot}`
  );
};

const handleToggleMegaDestroyTarget = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-mega-destroy') return s;
  if (!s.phase.slots.includes(slot)) return s;
  const phase = s.phase;
  const already = phase.selected.indexOf(slot);
  let selected: number[];
  if (already >= 0) {
    selected = phase.selected.filter(i => i !== slot);
  } else {
    if (phase.selected.length >= MEGA_DESTROY_MAX) return s;
    selected = [...phase.selected, slot];
  }
  return { ...s, phase: { ...phase, selected } };
};

const handleResolveMegaDestroy = (s: GameState): GameState => {
  if (s.phase.kind !== 'awaiting-special-mega-destroy') return s;
  const phase = s.phase;
  if (phase.selected.length === 0) return s;
  const { grid, removed } = executeMegaDestroy(s.grid, phase.selected);
  const newHand = consumeSpecial(s, phase.cardIdx);
  return log(
    {
      ...s,
      grid,
      discards: [...s.discards, ...removed],
      bonusCards: newHand,
      phase: { kind: 'awaiting-action' },
    },
    `Mega Destroy on ${phase.selected.length} slot${phase.selected.length === 1 ? '' : 's'}`
  );
};

const handleToggleSideSlidePick = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-side-slide-pick') return s;
  const phase = s.phase;
  // Toggle off: only allowed when the slot is an endpoint of the
  // current chain (so removing it keeps the rest contiguous).
  if (phase.selected.includes(slot)) {
    if (!canDeselectSideSlideSlot(phase.selected, slot)) return s;
    return {
      ...s,
      phase: { ...phase, selected: phase.selected.filter(x => x !== slot) },
    };
  }
  // Toggle on: must be a legal extension of the current chain.
  const extensions = sideSlideChainExtensions(s.grid, phase.selected);
  if (!extensions.includes(slot)) {
    // First pick of the run: extensions returns every occupied slot,
    // so this still allows the very first tap.
    if (phase.selected.length > 0) return s;
    if (s.grid[slot] === null) return s;
  }
  return {
    ...s,
    phase: { ...phase, selected: [...phase.selected, slot] },
  };
};

const handleSideSlideDonePicking = (s: GameState): GameState => {
  if (s.phase.kind !== 'awaiting-special-side-slide-pick') return s;
  const chain = s.phase.selected;
  if (chain.length < 2) return s;
  const moves = sideSlideDestinationsForChain(s.grid, chain);
  if (moves.length === 0) return s;
  return {
    ...s,
    phase: {
      kind: 'awaiting-special-side-slide-dest',
      cardIdx: s.phase.cardIdx,
      chain: [...chain],
      moves,
      previewPath: null,
      returnTo: s.phase.returnTo,
    },
  };
};

const handleSideSlidePreview = (
  s: GameState,
  path: Direction[] | null
): GameState => {
  if (s.phase.kind !== 'awaiting-special-side-slide-dest') return s;
  if (path === null) {
    if (s.phase.previewPath === null) return s; // no-op
    return { ...s, phase: { ...s.phase, previewPath: null } };
  }
  // Validate: must be one of the enumerated moves.
  const key = path.join(',');
  if (!s.phase.moves.some(m => m.path.join(',') === key)) return s;
  return { ...s, phase: { ...s.phase, previewPath: path } };
};

const handleResolveSideSlide = (
  s: GameState,
  path: Direction[]
): GameState => {
  if (s.phase.kind !== 'awaiting-special-side-slide-dest') return s;
  const phase = s.phase;
  // Match by path identity (joined string). Stale clicks against a
  // path that no longer exists in the move table are rejected.
  const key = path.join(',');
  const valid = phase.moves.find(m => m.path.join(',') === key);
  if (!valid) return s;
  const grid = executeSideSlide(s.grid, phase.chain, path);
  const newHand = consumeSpecial(s, phase.cardIdx);
  return log(
    { ...s, grid, bonusCards: newHand, phase: { kind: 'awaiting-action' } },
    `Slip & Slide ${path.join('-')}`
  );
};

const handleResolveJumpSource = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-jump-source') return s;
  if (!s.phase.sources.includes(slot)) return s;
  return {
    ...s,
    phase: {
      kind: 'awaiting-special-jump-dest',
      cardIdx: s.phase.cardIdx,
      source: slot,
      dests: emptySlots(s.grid),
      returnTo: s.phase.returnTo,
    },
  };
};

const handleResolveJump = (
  s: GameState,
  source: number,
  dest: number
): GameState => {
  if (s.phase.kind !== 'awaiting-special-jump-dest') return s;
  if (s.phase.source !== source) return s;
  if (!s.phase.dests.includes(dest)) return s;
  const grid = executeJump(s.grid, source, dest);
  const newHand = consumeSpecial(s, s.phase.cardIdx);
  return log(
    { ...s, grid, bonusCards: newHand, phase: { kind: 'awaiting-action' } },
    `Jump ${source}→${dest}`
  );
};

const handleToggleShuffleTarget = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-shuffle') return s;
  if (!s.phase.slots.includes(slot)) return s;
  const phase = s.phase;
  const already = phase.selected.indexOf(slot);
  let selected: number[];
  if (already >= 0) {
    selected = phase.selected.filter(i => i !== slot);
  } else {
    if (phase.selected.length >= SHUFFLE_PICK_MAX) return s;
    selected = [...phase.selected, slot];
  }
  return { ...s, phase: { ...phase, selected } };
};

const handleResolveShuffle = (
  s: GameState,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'awaiting-special-shuffle') return s;
  const phase = s.phase;
  if (phase.selected.length < SHUFFLE_PICK_MIN) return s;
  if (phase.selected.length > SHUFFLE_PICK_MAX) return s;
  const grid = executeShuffle(s.grid, phase.selected, rng);
  const newHand = consumeSpecial(s, phase.cardIdx);
  return log(
    { ...s, grid, bonusCards: newHand, phase: { kind: 'awaiting-action' } },
    `Shuffle on ${phase.selected.length} slots`
  );
};

const handleResolveRevive = (s: GameState, discardIdx: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-revive-pick') return s;
  if (discardIdx < 0 || discardIdx >= s.discards.length) return s;
  if (isFull(s.grid)) return s;
  const card = s.discards[discardIdx];
  const grid = placeAtSpiralNext(s.grid, card);
  const discards = s.discards.filter((_, i) => i !== discardIdx);
  const newHand = consumeSpecial(s, s.phase.cardIdx);
  // Revive can fill the LAST empty slot — the game ends immediately,
  // exactly as if the fill came from a placement (drawNext's full-grid
  // branch): the still-in-hand drawn card is set aside unscored.
  // Without this the run lingered in awaiting-action with a full board,
  // where the drawn card's suit perk was still usable — a fun exploit,
  // but it broke "the game ends the moment the board is full".
  const phase: GameState['phase'] = isFull(grid)
    ? { kind: 'game-over' }
    : { kind: 'awaiting-action' };
  return log(
    {
      ...s,
      grid,
      discards,
      bonusCards: newHand,
      ...(phase.kind === 'game-over' ? { drawn: null, scatterSlot: null } : {}),
      phase,
    },
    `Revive discard #${discardIdx}`
  );
};

const handleToggleRewindTarget = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-rewind') return s;
  if (!s.phase.slots.includes(slot)) return s;
  const phase = s.phase;
  const already = phase.selected.indexOf(slot);
  let selected: number[];
  if (already >= 0) {
    selected = phase.selected.filter(i => i !== slot);
  } else {
    if (phase.selected.length >= REWIND_PICK_MAX) return s;
    selected = [...phase.selected, slot];
  }
  return { ...s, phase: { ...phase, selected } };
};

const handleResolveRewind = (
  s: GameState,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'awaiting-special-rewind') return s;
  const phase = s.phase;
  if (phase.selected.length < REWIND_PICK_MIN) return s;
  if (phase.selected.length > REWIND_PICK_MAX) return s;
  const { grid, deck } = executeRewind(s.grid, phase.selected, s.deck, rng);
  const newHand = consumeSpecial(s, phase.cardIdx);
  return log(
    {
      ...s,
      grid,
      deck,
      bonusCards: newHand,
      phase: { kind: 'awaiting-action' },
    },
    `Rewind on ${phase.selected.length} slots`
  );
};

const handlePlusMinusTarget = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-special-plus-minus-target') return s;
  if (!s.phase.slots.includes(slot)) return s;
  return {
    ...s,
    phase: {
      kind: 'awaiting-special-plus-minus-direction',
      cardIdx: s.phase.cardIdx,
      target: slot,
      returnTo: s.phase.returnTo,
    },
  };
};

const handleResolvePlusMinus = (s: GameState, delta: 1 | -1): GameState => {
  if (s.phase.kind !== 'awaiting-special-plus-minus-direction') return s;
  const phase = s.phase;
  const card = s.grid[phase.target];
  if (!card || isJoker(card)) return s;
  const grid = s.grid.slice();
  grid[phase.target] = { ...card, rank: shiftRank(card.rank, delta) };
  const newHand = consumeSpecial(s, phase.cardIdx);
  return log(
    { ...s, grid, bonusCards: newHand, phase: { kind: 'awaiting-action' } },
    `Plus/Minus ${delta > 0 ? '+1' : '-1'} on slot ${phase.target}`
  );
};

// ---------- bonus card handlers ----------

// Send `drawn` cards back to bottom of bonus deck (in the given order), then
// retire the club, then advance. A club whose draw the player actually
// resolved into a card counts as a spent perk (Burnout / Frugal read that
// pile); a DECLINED draw retires the club to the discards instead — the
// player got nothing from it, so it doesn't move the perk count.
const finishBonusFlow = (
  s: GameState,
  returningDrawn: BonusCard[],
  newBonusCards: BonusCard[],
  rng: () => number,
  tookCard = true
): GameState => {
  if (!s.drawn || isJoker(s.drawn)) return s;
  const retire = tookCard ? pushPerkSpent : pushDiscard;
  return drawNext(
    log(
      retire(
        {
          ...s,
          bonusDeck: [...s.bonusDeck, ...returningDrawn],
          bonusCards: newBonusCards,
        },
        // pushPerkSpent strips Double Duty duals itself; the discard
        // path takes the active half directly (same as plain Discard).
        tookCard ? s.drawn : activeHalf(s.drawn)
      ),
      tookCard ? 'Bonus draw resolved' : 'Bonus draw declined'
    ),
    rng
  );
};

// Spotlight is exclusive — it cannot share the bonus hand with any
// other card. The "last added wins" rule keeps the logic symmetric:
// if Spotlight ends up co-resident with one or more other cards,
// whichever was added in THIS transition stays and the rest get
// dropped. Callers pass the card they just added so the rule knows
// which side to evict.
const enforceSpotlight = (
  proposedHand: BonusCard[],
  justAdded: BonusCard
): BonusCard[] => {
  const hasSpotlight = proposedHand.some(c => c.id === SPOTLIGHT_ID);
  const hasOthers = proposedHand.some(c => c.id !== SPOTLIGHT_ID);
  if (!hasSpotlight || !hasOthers) return proposedHand;
  // Mixed hand → resolve to whoever was just added.
  if (justAdded.id === SPOTLIGHT_ID) {
    return proposedHand.filter(c => c.id === SPOTLIGHT_ID);
  }
  return proposedHand.filter(c => c.id !== SPOTLIGHT_ID);
};

// Mixed Bag variant of Spotlight enforcement: same exclusivity rule
// (Spotlight clears other unused cards on pickup; the next acquired
// card discards Spotlight), but the hand keeps its fixed slot
// layout. Used green specials and placeholders are NEVER discarded
// — used specials stay in their slot (disabled for the rest of the
// run) and placeholders are inert slot markers, not "other bonus
// cards" in the Spotlight sense.
const enforceSpotlightMixedBag = (
  hand: BonusCard[],
  justAdded: BonusCard,
  slotCategories: SlotKind[]
): BonusCard[] => {
  const hasSpotlight = hand.some(c => c.id === SPOTLIGHT_ID);
  if (!hasSpotlight) return hand;
  const isClearable = (c: BonusCard): boolean =>
    c.id !== SPOTLIGHT_ID && !isPlaceholder(c) && !(c.specialKind && c.used);
  const hasOtherClearable = hand.some(isClearable);
  if (!hasOtherClearable && justAdded.id !== SPOTLIGHT_ID) return hand;
  if (justAdded.id === SPOTLIGHT_ID) {
    // Spotlight just landed in its slot. Every OTHER slot that holds
    // a clearable card resets to its placeholder. Used specials and
    // existing placeholders stay put.
    return hand.map((c, i) => {
      if (c === justAdded) return c;
      if (isClearable(c)) return slotPlaceholder(slotCategories[i]);
      return c;
    });
  }
  // A new clearable card arrived — Spotlight has to go. Replace
  // whichever slot holds Spotlight with that slot's placeholder.
  return hand.map((c, i) =>
    c.id === SPOTLIGHT_ID ? slotPlaceholder(slotCategories[i]) : c
  );
};

const handleBonusKeep = (
  s: GameState,
  idx: number,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'bonus-card-resolving') return s;
  if (idx < 0 || idx >= s.phase.drawn.length) return s;
  const phase = s.phase;
  const kept = phase.drawn[idx];
  // Mixed Bag categorized-slot path: place the kept card at the
  // pre-chosen slot. Any prior occupant (placeholder OR a real card)
  // gets replaced — the player committed to that slot when they
  // picked it after ♣.
  if (phase.targetSlot !== undefined) {
    const newHand = s.bonusCards.slice();
    // If the previous occupant was a real bonus card (not a
    // placeholder), this is a forced swap — flag for the No Swap
    // achievement check the same way BONUS_REPLACE does.
    const prior = newHand[phase.targetSlot];
    const swappedReal = prior !== undefined && !isPlaceholder(prior);
    newHand[phase.targetSlot] = kept;
    // Spotlight exclusivity in Mixed Bag — clear out unused real
    // cards in the other slots when Spotlight arrives, or discard
    // Spotlight when another card lands while it's still held.
    // Used green specials and placeholders are preserved.
    const finalHand = s.slotCategories
      ? enforceSpotlightMixedBag(newHand, kept, s.slotCategories)
      : newHand;
    const returning = phase.drawn.filter((_, i) => i !== idx);
    return finishBonusFlow(
      swappedReal ? { ...s, swappedBonus: true } : s,
      returning,
      finalHand,
      rng
    );
  }
  // Spotlight bypasses the cap check: it evicts every other held card
  // on pickup via enforceSpotlight, so the bonus-card-replacing
  // "which one to swap out?" step is meaningless — the held cards all
  // get discarded regardless of which the player would tap. For
  // every other card the at-cap path still routes through
  // BONUS_SELECT_NEW + BONUS_REPLACE.
  if (
    kept.id !== SPOTLIGHT_ID &&
    s.bonusCards.length >= BONUS_HAND_LIMIT
  ) {
    return s;
  }
  const returning = phase.drawn.filter((_, i) => i !== idx);
  const newHand = enforceSpotlight([...s.bonusCards, kept], kept);
  return finishBonusFlow(s, returning, newHand, rng);
};

const handleBonusPickSlot = (s: GameState, slot: number): GameState => {
  if (s.phase.kind !== 'awaiting-bonus-slot-choice') return s;
  if (!s.slotCategories) return s;
  if (slot < 0 || slot >= s.slotCategories.length) return s;
  // Spent one-time slots are gone for the game, and under no-swap rules
  // a live card locks its slot — only open slots can draw.
  if (!slotDrawable(s, slot)) return s;
  const kind = s.slotCategories[slot];
  // Filter the deck to cards that fit this slot's category. Draw up
  // to 2 from the top of the filtered subset; the remaining (in
  // original order) becomes the new bonus deck.
  const eligible = s.bonusDeck.filter(c => cardMatchesSlot(c, kind));
  if (eligible.length === 0) return s;
  const drawCount = Math.min(2, eligible.length);
  const drawnSet = new Set(eligible.slice(0, drawCount));
  const drawn = eligible.slice(0, drawCount);
  const remainingDeck = s.bonusDeck.filter(c => !drawnSet.has(c));
  return {
    ...s,
    bonusDeck: remainingDeck,
    phase: {
      kind: 'bonus-card-resolving',
      drawn,
      targetSlot: slot,
      returnTo: 'awaiting-action',
    },
  };
};

const handleBonusSelectNew = (s: GameState, idx: number): GameState => {
  if (s.phase.kind !== 'bonus-card-resolving') return s;
  if (idx < 0 || idx >= s.phase.drawn.length) return s;
  if (s.bonusCards.length < BONUS_HAND_LIMIT) return s;
  return {
    ...s,
    phase: {
      kind: 'bonus-card-replacing',
      drawn: s.phase.drawn,
      pickedNew: idx,
      returnTo: s.phase.returnTo,
    },
  };
};

// Inverse of BONUS_SELECT_NEW: step back from the "pick a held card to
// swap out" screen to the card-select screen, so the player can pick a
// different drawn card or (easy mode) decline the forced swap. The held
// hand is untouched between the two steps, so restoring the resolving
// phase is a faithful "undo" of the select.
const handleBonusBack = (s: GameState): GameState => {
  if (s.phase.kind !== 'bonus-card-replacing') return s;
  return {
    ...s,
    phase: {
      kind: 'bonus-card-resolving',
      drawn: s.phase.drawn,
      returnTo: s.phase.returnTo,
    },
  };
};

const handleBonusReplace = (
  s: GameState,
  oldIdx: number,
  rng: () => number
): GameState => {
  if (s.phase.kind !== 'bonus-card-replacing') return s;
  const phase = s.phase;
  if (oldIdx < 0 || oldIdx >= s.bonusCards.length) return s;
  const newCard = phase.drawn[phase.pickedNew];
  if (!newCard) return s;
  const replaced = s.bonusCards.slice();
  replaced[oldIdx] = newCard;
  const newHand = enforceSpotlight(replaced, newCard);
  // The OTHER drawn card returns to the bottom of the bonus deck. The replaced
  // bonus card is gone (we don't model a bonus-card trash explicitly).
  const returningDrawn = phase.drawn.filter((_, i) => i !== phase.pickedNew);
  // Mark that a forced-swap happened — the No Swap challenge looks at this.
  return finishBonusFlow(
    { ...s, swappedBonus: true },
    returningDrawn,
    newHand,
    rng
  );
};

const handleBonusDecline = (s: GameState, rng: () => number): GameState => {
  if (
    s.phase.kind !== 'bonus-card-resolving' &&
    s.phase.kind !== 'bonus-card-replacing'
  ) {
    return s;
  }
  // Whether taking would FILL AN OPEN SPOT or REPLACE a held card
  // decides which decline rule applies. Mixed Bag's categorized draws
  // ask per-slot: its hand is always 3 entries (placeholders included),
  // so the raw length reads as "at cap" even when the chosen slot is
  // empty — the target slot's occupant is the real answer there.
  const targetSlot =
    s.phase.kind === 'bonus-card-resolving' ? s.phase.targetSlot : undefined;
  const fillsOpenSpot =
    targetSlot !== undefined
      ? s.bonusCards[targetSlot] === undefined ||
        isPlaceholder(s.bonusCards[targetSlot])
      : s.bonusCards.length < BONUS_HAND_LIMIT;
  // Filling an open spot: declining is a DIFFICULTY rule (Short
  // Circuit's random ♣ included): on Easy a taken card can always be
  // swapped out later, so taking is free and there's nothing to
  // decline; Medium+ taking is binding (forced swap at the cap on
  // Medium, no swaps at all on Hard/Extreme), so the player may wave
  // the draw off and wait for a better offer.
  if (fillsOpenSpot) {
    if (s.difficulty === 'easy') return s;
  } else if (!s.bonusDeclineAllowed) {
    // Replacing a held card, declining is normally not allowed — the
    // player must take one of the drawn cards and swap one out. Easy
    // flips this via bonusDeclineAllowed so the player can keep their
    // existing hand.
    return s;
  }
  // Declined: no card taken, so the club retires to discards, not
  // perkSpent (see finishBonusFlow).
  return finishBonusFlow(s, s.phase.drawn, s.bonusCards, rng, false);
};

const handleCancelAction = (s: GameState): GameState => {
  switch (s.phase.kind) {
    case 'awaiting-action':
    case 'game-over':
    case 'club-invest':
      // (club-invest = Bull Market's committed invest reveal — no cancel.)
      return s;
    case 'awaiting-target-slide-dest':
      // Back to source selection within the same slide flow.
      return {
        ...s,
        phase: {
          kind: 'awaiting-target-slide-source',
          sources: validSlideSources(s.grid),
          returnTo: s.phase.returnTo,
        },
      };
    case 'bonus-card-replacing':
      // Back to the resolve-pick step.
      return {
        ...s,
        phase: {
          kind: 'bonus-card-resolving',
          drawn: s.phase.drawn,
          returnTo: s.phase.returnTo,
        },
      };
    case 'awaiting-special-power-swap-dest':
      // Back to source selection within the same power-swap flow —
      // includes the previously-picked source as a valid candidate
      // again so the player can re-pick the first card.
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-power-swap-source',
          cardIdx: s.phase.cardIdx,
          slots: occupiedSlots(s.grid),
          returnTo: s.phase.returnTo,
        },
      };
    case 'awaiting-special-side-slide-dest':
      // Back to chain-pick within the same side-slide flow — preserve
      // the picked chain so the player can adjust it without
      // re-tapping from scratch.
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-side-slide-pick',
          cardIdx: s.phase.cardIdx,
          selected: [...s.phase.chain],
          returnTo: s.phase.returnTo,
        },
      };
    case 'awaiting-special-jump-dest':
      // Back to source selection so the player can re-pick which
      // card to move.
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-jump-source',
          cardIdx: s.phase.cardIdx,
          sources: occupiedSlots(s.grid),
          returnTo: s.phase.returnTo,
        },
      };
    case 'awaiting-target-hop':
    case 'awaiting-target-slide-source':
    case 'awaiting-target-destroy':
    case 'awaiting-target-spin':
    case 'bonus-card-resolving':
    case 'awaiting-bonus-slot-choice':
      // Short Circuit: the random perk is committed the moment it is
      // revealed — bailing back to awaiting-action (and re-pressing
      // Perk) would re-roll the pick until a favorite comes up. The
      // flow must resolve. (Slide's dest→source step-back above stays
      // legal: it never leaves the perk.)
      if (s.randomPerks) return s;
      return { ...s, phase: { kind: s.phase.returnTo } };
    case 'awaiting-special-power-swap-source':
    case 'awaiting-special-doubler':
    case 'awaiting-special-wildcard':
    case 'awaiting-special-mega-destroy':
    case 'awaiting-special-side-slide-pick':
    case 'awaiting-special-jump-source':
    case 'awaiting-special-shuffle':
    case 'awaiting-special-plus-minus-target':
    case 'awaiting-special-revive-pick':
    case 'awaiting-special-rewind':
      return { ...s, phase: { kind: s.phase.returnTo } };
    case 'awaiting-special-plus-minus-direction':
      // Step back to target selection so the player can pick a
      // different card without losing the activation. Keeping the
      // card-idx threads the consumed flag through cleanly when
      // they do eventually commit.
      return {
        ...s,
        phase: {
          kind: 'awaiting-special-plus-minus-target',
          cardIdx: s.phase.cardIdx,
          slots: supercharchableSlots(s.grid),
          returnTo: s.phase.returnTo,
        },
      };
  }
};

// Actions that "commit" a turn (mutate grid / deck / bonusCards in a way the
// player would want to undo). Each of these pushes a snapshot of the prior
// state onto the undo stack.
const SNAP_ACTIONS = new Set<Action['type']>([
  'PLACE',
  'DISCARD_NONE',
  // Double Duty: undo restores the pre-flip orientation AND returns the
  // burned card to the top of the deck (full-state snapshot).
  'FLIP_CARD',
  'RESOLVE_HOP',
  'RESOLVE_SLIDE',
  'RESOLVE_DESTROY',
  'RESOLVE_SPIN',
  'BONUS_KEEP',
  'BONUS_REPLACE',
  'BONUS_DECLINE',
  'RESOLVE_CLUB_INVEST',
  // Special-card commits — each consumes a one-time card and mutates the
  // grid, so undo should restore both.
  'RESOLVE_POWER_SWAP',
  'RESOLVE_DOUBLER',
  'RESOLVE_WILDCARD',
  'RESOLVE_MEGA_DESTROY',
  'RESOLVE_SIDE_SLIDE',
  'RESOLVE_JUMP',
  'RESOLVE_SHUFFLE',
  'RESOLVE_PLUS_MINUS',
  'RESOLVE_REVIVE',
  'RESOLVE_REWIND',
]);

const handleUndo = (s: GameState): GameState => {
  const last = s.past[s.past.length - 1];
  if (!last) return s;
  return {
    ...last,
    past: s.past.slice(0, -1),
    // undoCount tracks total undos across the run; never reverts.
    undoCount: s.undoCount + 1,
  };
};

// Pure reducer. Random calls draw from state.rngState (a Mulberry32
// word), so calling step twice with the same state + action returns the
// same result — safe for React's re-invocation semantics and exact
// under UNDO (snapshots carry the pre-action word, so undo + redo
// replays the identical outcome rather than re-rolling).
//
// `rngOverride` is a legacy escape hatch for tests that thread their
// own closure; when provided, the in-state word is neither read nor
// advanced (the override owns the stream, as before).
export const step = (
  state: GameState,
  action: Action,
  rngOverride?: () => number
): GameState => {
  if (action.type === 'UNDO') return handleUndo(state);
  // >>> 0 normalizes states hydrated from older saves (no rngState) to
  // a valid word instead of NaN.
  let rngWord = state.rngState >>> 0;
  const rng =
    rngOverride ??
    (() => {
      const r = rngStep(rngWord);
      rngWord = r.next;
      return r.value;
    });
  let next: GameState;
  switch (action.type) {
    case 'PLACE':
      next = handlePlace(state, rng);
      break;
    case 'DISCARD_NONE':
      next = handleDiscardNone(state, rng);
      break;
    case 'FLIP_CARD':
      next = handleFlip(state);
      break;
    case 'BEGIN_SUIT_ACTION':
      next = handleBeginSuitAction(state, rng, action.forSuit);
      break;
    case 'RESOLVE_HOP':
      next = handleResolveHop(state, action.i, action.j, rng);
      break;
    case 'SLIDE_SELECT_SOURCE':
      next = handleSlideSelectSource(state, action.slot);
      break;
    case 'RESOLVE_SLIDE':
      next = handleResolveSlide(
        state,
        action.from,
        action.direction,
        action.distance,
        rng
      );
      break;
    case 'RESOLVE_DESTROY':
      next = handleResolveDestroy(state, action.slot, rng);
      break;
    case 'RESOLVE_SPIN':
      next = handleResolveSpin(state, action.slot, rng);
      break;
    case 'BONUS_KEEP':
      next = handleBonusKeep(state, action.idx, rng);
      break;
    case 'BONUS_SELECT_NEW':
      next = handleBonusSelectNew(state, action.idx);
      break;
    case 'BONUS_REPLACE':
      next = handleBonusReplace(state, action.oldIdx, rng);
      break;
    case 'BONUS_DECLINE':
      next = handleBonusDecline(state, rng);
      break;
    case 'BONUS_BACK':
      next = handleBonusBack(state);
      break;
    case 'BONUS_PICK_SLOT':
      next = handleBonusPickSlot(state, action.slot);
      break;
    case 'RESOLVE_CLUB_INVEST':
      next = handleResolveClubInvest(state, rng);
      break;
    case 'CANCEL_ACTION':
      next = handleCancelAction(state);
      break;
    case 'ACTIVATE_SPECIAL_CARD':
      next = handleActivateSpecial(state, action.idx);
      break;
    case 'RESOLVE_POWER_SWAP_SOURCE':
      next = handlePowerSwapSource(state, action.slot);
      break;
    case 'RESOLVE_POWER_SWAP':
      next = handlePowerSwap(state, action.i, action.j);
      break;
    case 'RESOLVE_DOUBLER':
      next = handleResolveDoubler(state, action.slot);
      break;
    case 'RESOLVE_WILDCARD':
      next = handleResolveWildcard(state, action.slot);
      break;
    case 'TOGGLE_MEGA_DESTROY_TARGET':
      next = handleToggleMegaDestroyTarget(state, action.slot);
      break;
    case 'RESOLVE_MEGA_DESTROY':
      next = handleResolveMegaDestroy(state);
      break;
    case 'TOGGLE_SIDE_SLIDE_PICK':
      next = handleToggleSideSlidePick(state, action.slot);
      break;
    case 'SIDE_SLIDE_DONE_PICKING':
      next = handleSideSlideDonePicking(state);
      break;
    case 'SIDE_SLIDE_PREVIEW':
      next = handleSideSlidePreview(state, action.path);
      break;
    case 'RESOLVE_SIDE_SLIDE':
      next = handleResolveSideSlide(state, action.path);
      break;
    case 'RESOLVE_JUMP_SOURCE':
      next = handleResolveJumpSource(state, action.slot);
      break;
    case 'RESOLVE_JUMP':
      next = handleResolveJump(state, action.source, action.dest);
      break;
    case 'TOGGLE_SHUFFLE_TARGET':
      next = handleToggleShuffleTarget(state, action.slot);
      break;
    case 'RESOLVE_SHUFFLE':
      next = handleResolveShuffle(state, rng);
      break;
    case 'RESOLVE_PLUS_MINUS_TARGET':
      next = handlePlusMinusTarget(state, action.slot);
      break;
    case 'RESOLVE_PLUS_MINUS':
      next = handleResolvePlusMinus(state, action.delta);
      break;
    case 'RESOLVE_REVIVE':
      next = handleResolveRevive(state, action.discardIdx);
      break;
    case 'TOGGLE_REWIND_TARGET':
      next = handleToggleRewindTarget(state, action.slot);
      break;
    case 'RESOLVE_REWIND':
      next = handleResolveRewind(state, rng);
      break;
  }
  if (next === state) return state;
  // Persist the advanced stream. Rejected actions (next === state, above)
  // deliberately don't advance it, and the snapshot below captures the
  // PRE-action word so UNDO rewinds the stream too. Skipped under
  // rngOverride — the caller's closure owns the stream in that mode.
  if (!rngOverride && rngWord !== (state.rngState >>> 0)) {
    next = { ...next, rngState: rngWord };
  }
  if (SNAP_ACTIONS.has(action.type) && state.phase.kind !== 'game-over') {
    // Undo after a forced swap (♣ at cap) should reopen the card-SELECT
    // popup, not the discard popup — so the player can pick the other
    // drawn card or (easy mode) decline. The swap ran through
    // resolving -> BONUS_SELECT_NEW -> replacing without a snapshot, so
    // capture the equivalent resolving phase here (the held hand is
    // unchanged between the two steps).
    const snapFrom: GameState =
      action.type === 'BONUS_REPLACE' &&
      state.phase.kind === 'bonus-card-replacing'
        ? {
            ...state,
            phase: {
              kind: 'bonus-card-resolving',
              drawn: state.phase.drawn,
              returnTo: state.phase.returnTo,
            },
          }
        : state;
    const snap: GameState = { ...snapFrom, past: [] };
    return { ...next, past: [...state.past, snap] };
  }
  return next;
};
