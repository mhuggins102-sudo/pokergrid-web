export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';

// Four lookup tables, one per "axis" of the difficulty curve. Each is
// the single source of truth for that aspect — the engine, the home-
// screen difficulty info popup, and the rules / tutorial screens all
// read from these.

export const TARGET_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 400,
  medium: 450,
  hard: 500,
  // Extreme matches Medium's 450 target on the number, but strips every
  // assist — no jokers, no discards, no deck peek, no undo — so it's the
  // toughest mode despite sharing Medium's headline number.
  extreme: 450,
};

// How many jokers ship in the playing deck. 0 (Extreme) means the deck
// is a pure 52-card deck; 2 (Easy) gives two wild slots, doubling the
// chance of a joker landing on the grid.
export const JOKERS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 2,
  medium: 1,
  hard: 1,
  extreme: 0,
};

// Undo cap per difficulty — the ONE table for every mode: Free Play,
// the Daily, Targets-Up, and Challenges (which run on the Hard ruleset)
// all read it via setupForMode (src/features/game/modes.ts). Only the
// tutorial pins 0, since a rewind would desync its coach script.
export const UNDOS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 2,
  medium: 1,
  hard: 1,
  extreme: 0,
};

// The undo clause for difficulty blurbs ("two undos" / "one undo" /
// "no undo") — shared by the Free Play cards and the Daily splash so
// the copy always matches the table above.
export const undoClauseFor = (d: Difficulty): string => {
  const undos = UNDOS_BY_DIFFICULTY[d];
  return undos === 0 ? 'no undo' : undos === 1 ? 'one undo' : `${undos} undos`;
};

// How many bonus cards the player starts the run holding. Easy / Medium
// open with a freebie so the player has something to plan around from
// the very first draw; Hard / Extreme start empty.
export const STARTER_BONUS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 1,
  medium: 1,
  hard: 0,
  extreme: 0,
};

// How the ♣ Bonus perk behaves once the player already holds the full 3
// bonus cards (the cap):
//   'available' — may take the draw (swapping one out) OR decline it.
//   'must'      — taking ♣ forces a swap; declining is not allowed.
//   'off'       — ♣ is disabled entirely at the cap: no draw, no swap. The
//                 player must decline earlier offers to save room, so a
//                 full hand is a real commitment.
export type BonusSwapAtCap = 'available' | 'must' | 'off';
export const BONUS_SWAP_AT_CAP_BY_DIFFICULTY: Record<Difficulty, BonusSwapAtCap> = {
  easy: 'available',
  medium: 'must',
  hard: 'off',
  extreme: 'off',
};

// Human labels for the in-game / Free Play difficulty read-outs.
export const BONUS_SWAP_LABEL: Record<BonusSwapAtCap, string> = {
  available: 'Available',
  must: 'Must',
  off: 'Off',
};

// When true, the player can decline a ♣ Bonus draw even at the bonus-
// hand cap (skip the forced swap). Derived from the swap mode above:
// only 'available' (Easy) lets the player keep their hand instead.
export const BONUS_DECLINE_AT_CAP_BY_DIFFICULTY: Record<Difficulty, boolean> = {
  easy: BONUS_SWAP_AT_CAP_BY_DIFFICULTY.easy === 'available',
  medium: BONUS_SWAP_AT_CAP_BY_DIFFICULTY.medium === 'available',
  hard: BONUS_SWAP_AT_CAP_BY_DIFFICULTY.hard === 'available',
  extreme: BONUS_SWAP_AT_CAP_BY_DIFFICULTY.extreme === 'available',
};

// When true, the Discard button is hidden and DISCARD_NONE is rejected
// by the reducer — every drawn card must be placed or spent on a perk.
export const NO_DISCARDS_BY_DIFFICULTY: Record<Difficulty, boolean> = {
  easy: false,
  medium: false,
  hard: false,
  extreme: true,
};

// Easy + Medium can peek the remaining-deck composition mid-run
// (RemainingDeckModal). Hard and Extreme run blind.
export const CAN_PREVIEW_DECK_BY_DIFFICULTY: Record<Difficulty, boolean> = {
  easy: true,
  medium: true,
  hard: false,
  extreme: false,
};

// Sentence fragment for the ♣-at-cap rule (used in the difficulty
// briefing sentences on the Daily splash and Free Play cards).
export const BONUS_SWAP_CLAUSE: Record<BonusSwapAtCap, string> = {
  available: 'may swap bonus cards',
  must: 'must swap bonus cards',
  off: 'no bonus card swap',
};

// The five fixed difficulty axes as sentence fragments, in the ONE
// canonical order shared by the Daily splash, the Free Play blurbs + card
// table, and the in-game popup:
//   jokers → starter bonus → bonus swap → deck peek → discards → (undo)
// The undo clause is appended by the caller — undoClauseFor(d) gives the
// standard wording off UNDOS_BY_DIFFICULTY, shared by every mode.
export const difficultyClauses = (d: Difficulty): string[] => {
  const j = JOKERS_BY_DIFFICULTY[d];
  return [
    j === 0 ? 'No jokers' : j === 1 ? 'One joker' : 'Two jokers',
    STARTER_BONUS_BY_DIFFICULTY[d] > 0
      ? 'one starter bonus card'
      : 'no starter bonus',
    BONUS_SWAP_CLAUSE[BONUS_SWAP_AT_CAP_BY_DIFFICULTY[d]],
    CAN_PREVIEW_DECK_BY_DIFFICULTY[d] ? 'deck peek on' : 'no deck peek',
    NO_DISCARDS_BY_DIFFICULTY[d] ? 'no discards' : 'discards on',
  ];
};

export const difficultySentence = (d: Difficulty, undoClause: string): string =>
  [...difficultyClauses(d), undoClause].join(', ') + '.';
