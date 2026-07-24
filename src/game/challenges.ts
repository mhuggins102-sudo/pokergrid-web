import { ScoreReport } from './scoring';
import type { GameState } from './state';
import { Difficulty, TARGET_BY_DIFFICULTY } from './rules';

// ============================================================================
// Challenges — playable game variants. The other entries that used to live
// here are now Achievements (src/game/achievements.ts) — those check a
// final-state condition on a normal Hard / Extreme run so they're earned
// passively. Only the variants that actually MODIFY gameplay live here —
// see the CHALLENGES catalog below for the full roster (each entry's
// synopsis/goal describes its twist). These double as the daily-puzzle
// twist pool (src/game/daily/recipe.ts).
// ============================================================================

export type ChallengeId =
  | 'short-deck'
  | 'no-discards'
  | 'short-circuit'
  | 'poker-purist'
  | 'three-tricks'
  | 'mixed-bag'
  | 'gridlock'
  | 'scatter'
  | 'bull-market'
  | 'double-duty'
  | 'spiraling';

export interface Challenge {
  id: ChallengeId;
  name: string;
  // One-line synopsis shown on the Challenges page tile (e.g.
  // "Deck: Contains only 45 cards"). Designed to fit in a single
  // line under the title + target row.
  synopsis: string;
  // Full description shown in the info popup. Includes the score
  // target and any background needed to understand the twist.
  goal: string;
  // Total score that must be reached.
  scoreTarget: number;
  // True if the structural condition is met by the final state + report.
  conditionMet: (state: GameState, report: ScoreReport) => boolean;
  // Optional: override the deck size at game start. Used by short-deck.
  deckLimit?: number;
}

// Ordered simplest → most complex. Drives the on-screen list order
// only — every challenge is playable from the start.
export const CHALLENGES: Challenge[] = [
  {
    id: 'short-deck',
    name: 'Short Deck',
    synopsis: 'Twist: Deck contains only 45 cards',
    goal: 'Score 500+ points with a 45-card deck. 8 cards are removed at random before the start of the game.',
    scoreTarget: 500,
    deckLimit: 45,
    conditionMet: () => true,
  },
  {
    id: 'poker-purist',
    name: 'Poker Purist',
    synopsis: 'Twist: No bonus cards',
    goal: 'Score 350+ points with no bonus cards at all — no starter, no ♣ draws, no multipliers. Pure rows and columns scoring as 5-card poker hands.',
    scoreTarget: 350,
    // Enforced at newGame: bonusCards and bonusDeck are both empty,
    // which naturally disables ♣ (canDrawBonus returns false) and
    // hides the bonus card strip in the UI.
    conditionMet: () => true,
  },
  {
    id: 'no-discards',
    name: 'No Discards',
    synopsis: 'Twist: Discard button disabled',
    goal: 'Score 500+ points without using the Discard button — every drawn card must be placed or spent on a suit perk.',
    scoreTarget: 500,
    // The Discard button is hidden in this challenge and the DISCARD_NONE
    // action is rejected by the reducer, so reaching the score target is
    // the only structural requirement.
    conditionMet: () => true,
  },
  {
    id: 'short-circuit',
    name: 'Short Circuit',
    synopsis: 'Twist: Suit perks fire at random',
    goal: "Score 500+ points with random suit perks — you won't know which of ♥/♠/♦/♣'s effects you'll get until you commit to spending the card.",
    scoreTarget: 500,
    // The randomness is enforced at the reducer level (state.randomPerks
    // is true and handleBeginSuitAction picks a uniformly-random perk
    // from those currently available). Hitting the score target is the
    // only end-state check.
    conditionMet: () => true,
  },
  {
    id: 'gridlock',
    name: 'Gridlock',
    synopsis: 'Twist: First 15 cards pre-placed at random',
    goal: 'Score 500+ points with 15 cards pre-placed at random positions on the grid. Spiral placement resumes from whichever slots are still empty — you fill the remaining 10 in normal play.',
    scoreTarget: 500,
    // Enforced at newGame: randomGridFill seeds 15 cards into random
    // positions before drawNext runs. The remaining deck is intact
    // and the spiral picks up from whichever slots stayed empty.
    conditionMet: () => true,
  },
  {
    id: 'scatter',
    name: 'Scatter',
    synopsis: 'Twist: Each card lands at a random spot',
    goal: 'Score 500+ points with no spiral. Every card drawn from the deck targets a random empty slot, re-rolled for each new card — even after you spend one on a suit perk. Jokers scatter too.',
    scoreTarget: 500,
    // Enforced at newGame: the scatter flag makes drawNext pick (and
    // re-roll) a random empty slot for every drawn card and auto-placed
    // joker, instead of following the spiral order.
    conditionMet: () => true,
  },
  {
    id: 'mixed-bag',
    name: 'Mixed Bag',
    synopsis: 'Twist: Bonus slots locked to green/yellow/purple',
    goal: 'Score 500+ points with bonus slots locked to categories. Slot 1 holds a green one-time action card — tap it to read what it does, then tap Use to fire it; it\'s consumed on use. Slot 2 holds a yellow (per-line) card and slot 3 a purple (end-game) card. ♣ asks which slot to draw for, then shows 2 category-matching cards to pick from.',
    scoreTarget: 500,
    // Enforced at newGame via slotCategories — placeholders seed the
    // three slots in category order, and ♣ filters draws to match.
    conditionMet: () => true,
  },
  {
    id: 'three-tricks',
    name: 'Three Tricks',
    synopsis: 'Twist: Bonus slots locked to green only',
    goal: 'Score 500+ points with no bonus-card deck. Instead you start holding three green one-time action cards (the kind Mixed Bag\'s green slot draws), dealt at random from the full special deck — tap one to read it, tap Use to fire it; each is consumed on use.',
    scoreTarget: 500,
    // Enforced at newGame: noBonusCards strips the regular bonus deck,
    // and initialBonusCards seeds the hand with three random specials.
    // App.tsx wires the seeding via contextInitialBonusCards.
    conditionMet: () => true,
  },
  {
    id: 'bull-market',
    name: 'Bull Market',
    synopsis: 'Twist: ♣ invests in hand values',
    goal: 'Score 500+ points with no bonus cards. Instead, spending a club on its ♣ perk "invests" twice its blackjack value (2–9 face, 10–K = 10, A = 11; so a 7 adds 14, an Ace adds 22) into a random hand type, permanently raising that hand\'s base value. Boosts stack — press ⓘ to see the revised hand values.',
    scoreTarget: 500,
    // Enforced at newGame: noBonusCards strips the bonus deck and
    // investHands repurposes the ♣ perk to boost a random hand's base.
    conditionMet: () => true,
  },
  {
    id: 'double-duty',
    name: 'Double Duty',
    synopsis: 'Twist: Two-way cards — Flip burns 2 cards',
    goal: 'Score 500+ points with a two-way deck. Every card carries a second identity printed upside-down on its bottom half — each rank+suit appears exactly twice across the deck, paired at random each game. Flip the drawn card (once per card) to play its other half; the cost: the next two deck cards are burned, sight unseen — so neither of the last 2 cards can flip. Jokers can\'t flip.',
    scoreTarget: 500,
    // Enforced at newGame (dual identities assigned to the deck) and by
    // the FLIP_CARD reducer guards. Hitting the score target is the only
    // end-state check.
    conditionMet: () => true,
  },
  {
    id: 'spiraling',
    name: 'Spiraling',
    synopsis: 'Twist: ♠ spirals a card outward by its pips',
    goal: "Score 500+ points with a rewired ♠ perk: instead of sliding, pick any card on the board and it travels OUTWARD along the spiral by the played spade's pip value (A=1, 2–10 face value, J=11, Q=12, K=13) — a card on spiral space 1, moved by a 9♠, lands on space 10. It jumps over cards along the way, but the landing space must be empty and within the spiral (space 25 is the end). Tap a card to preview its landing spot, then tap that spot to commit.",
    scoreTarget: 500,
    // Enforced at the reducer level: state.spiraling reroutes ♠ from the
    // slide flow into the spiral flow. Hitting the score target is the
    // only end-state check.
    conditionMet: () => true,
  },
];

export const findChallenge = (id: ChallengeId): Challenge => {
  const c = CHALLENGES.find(x => x.id === id);
  if (!c) throw new Error(`Unknown challenge: ${id}`);
  return c;
};

export const challengeWon = (
  challenge: Challenge,
  state: GameState,
  report: ScoreReport
): boolean =>
  report.total >= challenge.scoreTarget && challenge.conditionMet(state, report);

// ============================================================================
// Targets Up — Levels mode.
//
// +25 every level, starting at 400. Levels 1–2 sit at Easy's
// 400 / 425; L3–4 cross into Medium (450 / 475); L5+ enters Hard
// (500, 525, 550, ...). No step-up cadence change — the climb is
// linear and the difficulty automatically tracks the Free Play
// target tiers.
//
// On a win, level += 1 and target advances by +25.
// On a loss, the run is over; the final result is the number of
// consecutive wins (= level - 1).
// ============================================================================

export const TARGETS_UP_BASE = 400;
// Constant step size across every level. Keeps the climb honest
// and aligns each tier of 2 levels with a Free Play difficulty.
export const TARGETS_UP_STEP = 25;

export const targetForLevel = (level: number): number =>
  TARGETS_UP_BASE + (level - 1) * TARGETS_UP_STEP;

// Targets Up runs on Easy / Medium / Hard settings depending on the
// level's target, keyed off the Free Play target schedule so the
// two stay in sync:
//
//   target < Medium's Free Play target → Easy settings
//   target < Hard's   Free Play target → Medium settings
//   target ≥ Hard's   Free Play target → Hard settings
//
// With the current schedule (Easy 400 / Medium 450 / Hard 500) this
// works out to:
//   L1–2 (400 / 425) → Easy
//   L3–4 (450 / 475) → Medium
//   L5+  (500 / 525 / …)   → Hard
//
// Extreme is never selected — Targets Up doesn't strip tools the
// way Extreme does even at its hardest levels.
export const difficultyForLevel = (level: number): Difficulty => {
  const t = targetForLevel(level);
  if (t < TARGET_BY_DIFFICULTY.medium) return 'easy';
  if (t < TARGET_BY_DIFFICULTY.hard) return 'medium';
  return 'hard';
};
