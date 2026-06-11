import { Action } from '../../game/state';
import { TUTORIAL_TARGET } from './tutorialGame';

/**
 * The coach script for the guided first game. Steps come in three
 * kinds:
 *
 *  - 'info'   — copy only; the board is inert and a Next button
 *               advances.
 *  - 'action' — the player must make a move. The action gate lets
 *               through only `allows` (plus CANCEL_ACTION, so backing
 *               out of a half-started perk never strands anyone);
 *               the step completes on the first dispatch matching
 *               `completes`.
 *  - 'free'   — the guided portion is over; everything is allowed and
 *               the coach dismisses.
 *
 * The expected moves are dictated by the scripted deal in
 * tutorialGame.ts — keep the two files in lockstep (enforced by
 * tutorialScript.test.ts).
 */
export interface TutorialStep {
  id: string;
  kind: 'info' | 'action' | 'free';
  title: string;
  body: string;
  /** Dock button to spotlight while waiting ('place' | 'perk' | 'discard'). */
  highlight?: 'place' | 'perk' | 'discard';
  allows?: (a: Action) => boolean;
  completes?: (a: Action) => boolean;
}

const oneOf =
  (...types: Action['type'][]) =>
  (a: Action) =>
    types.includes(a.type);

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'welcome',
    kind: 'info',
    title: 'Welcome to PokerGrid',
    body:
      'This is a guided practice deal. You place 25 cards on a 5×5 grid; at the end, ' +
      'every row and every column scores as a poker hand — ten hands at once. ' +
      `Beat the practice target of ${TUTORIAL_TARGET}. The deck is rigged so you can try every move.`,
  },
  {
    id: 'place-first',
    kind: 'action',
    title: 'Place your first card',
    body:
      'Cards fill the grid along a spiral: center first, then clockwise outward. ' +
      'The pulsing slot is where the next card lands. Tap Place to put the K♠ beside the 7♥.',
    highlight: 'place',
    allows: oneOf('PLACE'),
    completes: oneOf('PLACE'),
  },
  {
    id: 'place-second',
    kind: 'action',
    title: 'Keep the spiral going',
    body: 'Place the 4♣ — it drops into the next spiral slot, below the K♠.',
    highlight: 'place',
    allows: oneOf('PLACE'),
    completes: oneOf('PLACE'),
  },
  {
    id: 'place-third',
    kind: 'action',
    title: 'A second king',
    body:
      'Place the K♦. It lands next to the 4♣ — not in line with the other king, ' +
      "but we'll fix that in a moment.",
    highlight: 'place',
    allows: oneOf('PLACE'),
    completes: oneOf('PLACE'),
  },
  {
    id: 'perks-intro',
    kind: 'info',
    title: 'Every suit is a power',
    body:
      'Instead of placing a drawn card, you can spend it on its suit’s perk: ' +
      '♥ swaps two cards, ♠ slides a chain, ♦ destroys a card, ♣ draws a bonus card. ' +
      'The drawn card is used up either way. Let’s try all four.',
  },
  {
    id: 'hop',
    kind: 'action',
    title: '♥ Swap',
    body:
      'Spend the 9♥ to swap any two cards that share a row or column. ' +
      'Tap ♥ Swap, then swap the K♦ with the 4♣ — both kings line up, and a pair of kings scores on that column.',
    highlight: 'perk',
    allows: oneOf('BEGIN_SUIT_ACTION', 'RESOLVE_HOP'),
    completes: oneOf('RESOLVE_HOP'),
  },
  {
    id: 'place-fourth',
    kind: 'action',
    title: 'A dud card',
    body:
      'Back to normal play — place the 2♣. Low offsuit cards like this drag a line down. ' +
      'Good thing diamonds exist…',
    highlight: 'place',
    allows: oneOf('PLACE'),
    completes: oneOf('PLACE'),
  },
  {
    id: 'destroy',
    kind: 'action',
    title: '♦ Destroy',
    body:
      'Spend the 9♦ to remove any card from the grid. Tap ♦ Destroy, then the 2♣ you just placed. ' +
      'Both cards leave play and the slot reopens — and watch the pulsing marker jump back to it: ' +
      'placing always fills the earliest empty spiral slot first.',
    highlight: 'perk',
    allows: oneOf('BEGIN_SUIT_ACTION', 'RESOLVE_DESTROY'),
    completes: oneOf('RESOLVE_DESTROY'),
  },
  {
    id: 'slide',
    kind: 'action',
    title: '♠ Slide',
    body:
      'Spend the 9♠ to slide a card — plus any chain of cards in front of it — along its row or column. ' +
      'Tap ♠ Slide, pick a card, then pick where its leading edge should land. Try sliding the 4♣ into the empty slot.',
    highlight: 'perk',
    allows: oneOf('BEGIN_SUIT_ACTION', 'SLIDE_SELECT_SOURCE', 'RESOLVE_SLIDE'),
    completes: oneOf('RESOLVE_SLIDE'),
  },
  {
    id: 'bonus',
    kind: 'action',
    title: '♣ Bonus',
    body:
      'Spend the 9♣ to draw two bonus cards and keep one. Bonus cards multiply line scores or pay off at game end — ' +
      'you already hold one from the deal (the strip by the board) and can hold up to three.',
    highlight: 'perk',
    allows: oneOf(
      'BEGIN_SUIT_ACTION',
      'BONUS_KEEP',
      'BONUS_SELECT_NEW',
      'BONUS_REPLACE',
      'BONUS_DECLINE'
    ),
    completes: oneOf('BONUS_KEEP', 'BONUS_REPLACE', 'BONUS_DECLINE'),
  },
  {
    id: 'joker',
    kind: 'info',
    title: 'The joker is wild',
    body:
      'Did you spot it? A drawn joker places itself — it landed in the slot your slide left open, since ' +
      'placing always backfills the earliest empty spiral slot. On the grid it counts as whatever rank and ' +
      'suit score best for its row and column. Only ♦ Destroy removes one.',
  },
  {
    id: 'discard',
    kind: 'action',
    title: 'Or just let it go',
    body:
      'Sometimes the best move is none: Discard throws the drawn card away without filling a slot. ' +
      '(Extreme difficulty takes this away.) Discard the 2♦.',
    highlight: 'discard',
    allows: oneOf('DISCARD_NONE'),
    completes: oneOf('DISCARD_NONE'),
  },
  {
    id: 'scoring',
    kind: 'info',
    title: 'How scoring works',
    body:
      'The game ends when the grid fills — or the deck runs out. Each of the 10 lines then scores as its best ' +
      'poker hand: a pair is 5 points, a royal flush 120. Bonus cards multiply, and they stack multiplicatively. ' +
      'A line missing cards scores −25 instead. Tap Lines for the live per-line breakdown, and the ⓘ button by ' +
      'the score for what every hand pays.',
  },
  {
    id: 'good-to-know',
    kind: 'info',
    title: 'Good to know',
    body:
      'You can hold at most three bonus cards — at the cap, a ♣ draw forces a swap (Easy lets you decline). ' +
      'The deck counter sits beside the drawn card; Peek lists every card left (Easy and Medium). When the ' +
      'deck runs dry, unfilled slots become those −25 lines.',
  },
  {
    id: 'free',
    kind: 'free',
    title: 'You’re on your own',
    body:
      `Finish the deal: fill all 25 slots, spend perks when they pay, and beat ${TUTORIAL_TARGET}. ` +
      'Good luck!',
  },
];
