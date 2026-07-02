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
      'This is a guided practice deal. You’ll fill the 5×5 grid; at the end, every row ' +
      'and every column scores as a poker hand — ten hands at once.',
  },
  {
    id: 'target',
    kind: 'info',
    title: 'The practice target',
    body:
      `Beat ${TUTORIAL_TARGET} to win this deal. The deck is rigged so you can safely try ` +
      'every move — nothing here counts toward your stats.',
  },
  {
    id: 'place-first',
    kind: 'action',
    title: 'Place your first card',
    body:
      'Cards fill the grid in a spiral: center first, then clockwise outward. The pulsing ' +
      'slot is next. Tap Place to put the K♠ beside the 7♥.',
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
      'Place the K♦. It lands beside the 4♣ — not in line with the other king yet, but ' +
      'we’ll fix that in a moment.',
    highlight: 'place',
    allows: oneOf('PLACE'),
    completes: oneOf('PLACE'),
  },
  {
    id: 'perks-intro',
    kind: 'info',
    title: 'Every suit is a power',
    body:
      'Instead of placing a drawn card, you can spend it on its suit’s perk: ♥ swaps, ' +
      '♠ slides, ♦ destroys, ♣ draws a bonus card. Let’s try all four.',
  },
  {
    id: 'hop',
    kind: 'action',
    title: '♥ Swap',
    body:
      'Spend the 9♥ to swap two cards that share a row or column. Tap ♥ Swap, then swap ' +
      'the K♦ with the 4♣ — the kings line up and start scoring.',
    highlight: 'perk',
    allows: oneOf('BEGIN_SUIT_ACTION', 'RESOLVE_HOP'),
    completes: oneOf('RESOLVE_HOP'),
  },
  {
    id: 'place-fourth',
    kind: 'action',
    title: 'A dud card',
    body:
      'Back to normal play — place the 2♣. Low offsuit cards drag their lines down. ' +
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
      'Spend the 9♦ to remove any card from the grid. Tap ♦ Destroy, then the 2♣ you ' +
      'just placed — both cards leave play and the slot reopens.',
    highlight: 'perk',
    allows: oneOf('BEGIN_SUIT_ACTION', 'RESOLVE_DESTROY'),
    completes: oneOf('RESOLVE_DESTROY'),
  },
  {
    id: 'spiral-backfill',
    kind: 'info',
    title: 'The spiral backfills',
    body:
      'See the pulsing marker jump back to the hole? Placing always fills the earliest ' +
      'empty spiral slot — holes get patched before the spiral grows.',
  },
  {
    id: 'slide',
    kind: 'action',
    title: '♠ Slide',
    body:
      'Spend the 9♠ to slide a card along its row or column — any chain in front moves ' +
      'with it. Tap ♠ Slide and move the 4♣ into the empty slot.',
    highlight: 'perk',
    allows: oneOf('BEGIN_SUIT_ACTION', 'SLIDE_SELECT_SOURCE', 'RESOLVE_SLIDE'),
    completes: oneOf('RESOLVE_SLIDE'),
  },
  {
    id: 'bonus',
    kind: 'action',
    title: '♣ Bonus',
    body:
      'Spend the 9♣ to draw two bonus cards and keep one. Bonus cards multiply line ' +
      'scores or pay off at game end.',
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
      'Did you spot it? A drawn joker places itself — into the earliest empty spiral ' +
      'slot, as always. No perk, no discard for jokers.',
  },
  {
    id: 'joker-hands',
    kind: 'info',
    title: 'A shape-shifter',
    body:
      'On the grid the joker counts as whatever rank and suit score best — judged ' +
      'separately for its row and its column. Only ♦ Destroy removes one.',
  },
  {
    id: 'discard',
    kind: 'action',
    title: 'Or just let it go',
    body:
      'Sometimes the best move is none. Discard the 2♦ — it leaves play without ' +
      'filling a slot. (Extreme difficulty bans discards.)',
    highlight: 'discard',
    allows: oneOf('DISCARD_NONE'),
    completes: oneOf('DISCARD_NONE'),
  },
  {
    id: 'scoring',
    kind: 'info',
    title: 'How the game ends',
    body:
      'The game ends when the grid fills — or the deck runs out. Every row and column ' +
      'then scores as its best five-card poker hand.',
  },
  {
    id: 'scoring-values',
    kind: 'info',
    title: 'What hands pay',
    body:
      'A pair pays 5 points, a royal flush 120. Bonus cards multiply line scores — and ' +
      'they stack. A line missing cards scores −25 instead.',
  },
  {
    id: 'scoring-tools',
    kind: 'info',
    title: 'Your dashboards',
    body:
      'Tap Lines for the live per-line breakdown, and the ⓘ button by the score for ' +
      'what every hand pays.',
  },
  {
    id: 'score-tiers',
    kind: 'info',
    title: 'Chasing a grade?',
    body:
      'Your result earns a tier from D up to SS (Perfect). Tap the score itself any ' +
      'time to see every tier and the exact score it needs.',
  },
  {
    id: 'spotlight',
    kind: 'info',
    title: 'Inspect any card',
    body:
      'Tap a card already on the grid to spotlight its row and column with their ' +
      'current totals — handy before committing a swap or slide. Tap it again to clear.',
  },
  {
    id: 'bonus-hand',
    kind: 'info',
    title: 'Your bonus hand',
    body:
      'You can hold three bonus cards at most — at the cap, a ♣ draw forces a swap ' +
      '(Easy lets you decline). Tap a held card any time for its full details.',
  },
  {
    id: 'deck-watch',
    kind: 'info',
    title: 'Watch the deck',
    body:
      'The counter beside the drawn card tracks what’s left; Peek lists every card ' +
      '(Easy and Medium). When the deck runs dry, unfilled slots become −25 lines.',
  },
  {
    id: 'undo',
    kind: 'info',
    title: 'One step back',
    body:
      'Easy, Medium, and daily puzzles include an undo that rolls back your whole ' +
      'last move. Hard, Extreme, and Challenges play for keeps.',
  },
  {
    id: 'free',
    kind: 'free',
    title: 'You’re on your own',
    body:
      `Finish the deal: fill all 25 slots, spend perks when they pay, and beat ${TUTORIAL_TARGET}. ` +
      'When you’re done, the Daily puzzle and the Challenges are waiting. Good luck!',
  },
];
