import { Card, RANKS, Rank, SUITS, Suit } from '../../game/cards';
import { seededRng, shuffle } from '../../game/deck';
import { emptyGrid } from '../../game/grid';
import { GameState, newGame } from '../../game/state';

/**
 * The guided first game runs on a handcrafted deal: the opening cards
 * arrive in a fixed order so each coach step can demonstrate one move
 * (place, ♥ swap, ♦ destroy, ♠ slide, ♣ bonus, joker, discard) against
 * a board state the copy can reference by name. After the scripted
 * opening, the rest of a normal Easy deck (shuffled by TUTORIAL_SEED)
 * carries the player to a real finished game and the real result
 * screen.
 */

/** Soft practice goal — well under the Easy 400 so a guided novice
 *  finishing the grid almost always beats it. */
export const TUTORIAL_TARGET = 250;

// Chosen so the starter bonus card and both ♣-lesson draws are plain
// multiplier cards (no Spotlight exclusivity surprises mid-lesson).
const TUTORIAL_SEED = 20260600;

const C = (rank: Rank, suit: Suit): Card => ({ kind: 'standard', rank, suit });
const JOKER: Card = { kind: 'joker' };

/** Pre-placed at the center slot (12) before the first turn. */
export const TUTORIAL_CENTER_CARD = C('7', 'H');

/**
 * The drawn sequence, in order. Slots fill along the spiral
 * (12 → 13 → 18 → 17 → 16 → …); the coach steps in tutorialSteps.ts
 * mirror this order exactly — tutorialScript.test.ts keeps the two
 * in sync.
 *
 *  K♠  place → 13            first king
 *  4♣  place → 18            filler the ♥ swap will move
 *  K♦  place → 17            second king, deliberately misaligned
 *  9♥  ♥ swap 17↔18          kings line up in column 3
 *  2♣  place → 16            junk card for the ♦ demo
 *  9♦  ♦ destroy slot 16     removes the 2♣, reopens the slot
 *  9♠  ♠ slide               e.g. 4♣ left into the gap (any slide ok)
 *  9♣  ♣ bonus draw          keep 1 of 2
 *  🃏  place → joker lesson
 *  2♦  discard lesson
 */
export const TUTORIAL_OPENING: readonly Card[] = [
  C('K', 'S'),
  C('4', 'C'),
  C('K', 'D'),
  C('9', 'H'),
  C('2', 'C'),
  C('9', 'D'),
  C('9', 'S'),
  C('9', 'C'),
  JOKER,
  C('2', 'D'),
];

const sameCard = (a: Card, b: Card): boolean =>
  a.kind === 'standard' &&
  b.kind === 'standard' &&
  a.rank === b.rank &&
  a.suit === b.suit;

/**
 * Build the tutorial's starting state. Rides on newGame('easy') for
 * everything non-deck (bonus starters, flags, target), then swaps in
 * the scripted grid/drawn/deck. Fully deterministic — same deal for
 * every player, every replay.
 */
export const tutorialStart = (): GameState => {
  const rng = seededRng(TUTORIAL_SEED);
  const base = newGame('easy', rng, { targetOverride: TUTORIAL_TARGET });

  const used = [TUTORIAL_CENTER_CARD, ...TUTORIAL_OPENING];
  const remainderPool: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const card = C(rank, suit);
      if (!used.some(u => sameCard(u, card))) remainderPool.push(card);
    }
  }
  // Easy decks carry two jokers; the opening spends one, the shuffled
  // tail keeps the other in circulation.
  const remainder = shuffle([...remainderPool, JOKER], rng);

  const grid = emptyGrid();
  grid[12] = TUTORIAL_CENTER_CARD;

  return {
    ...base,
    grid,
    drawn: TUTORIAL_OPENING[0],
    deck: [...TUTORIAL_OPENING.slice(1), ...remainder],
    discards: [],
    perkSpent: [],
    history: ['Tutorial start'],
    past: [],
    phase: { kind: 'awaiting-action' },
  };
};
