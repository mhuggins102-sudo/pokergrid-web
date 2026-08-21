import { ScoreReport } from './scoring';
import type { GameState } from './state';
import {
  BONUS_SWAP_AT_CAP_BY_DIFFICULTY,
  BONUS_SWAP_CLAUSE,
  CAN_PREVIEW_DECK_BY_DIFFICULTY,
  Difficulty,
  JOKERS_BY_DIFFICULTY,
  NO_DISCARDS_BY_DIFFICULTY,
  STARTER_BONUS_BY_DIFFICULTY,
  TARGET_BY_DIFFICULTY,
  difficultySentence,
  undoClauseFor,
} from './rules';

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
  | 'spiraling'
  | 'time-trial'
  | 'nut-low'
  | 'draw-poker';

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
  // Not ready for prime time: kept in the catalog (routes, archived
  // plays, and findChallenge still work) but left off the Challenges
  // page, the beaten-count math, and the daily rotation.
  hidden?: boolean;
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
    goal: 'Score 350+ points with no bonus cards available. Just pure rows and columns scoring as 5-card poker hands.',
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
    goal: 'Score 500+ points without using the Discard button. Every drawn card must be placed or spent on a suit perk.',
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
    goal: "Score 500+ points with random suit perks. You won't know which effect you'll get until you commit to spending the card.",
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
    goal: 'Score 500+ points with the grid seeded by randomly placing the first 15 cards. Regular gameplay starts thereafter.',
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
    goal: 'Score 500+ points with no spiral. Every card drawn from the deck moves the placement position to a random empty slot.',
    scoreTarget: 500,
    // Enforced at newGame: the scatter flag makes drawNext pick (and
    // re-roll) a random empty slot for every drawn card and auto-placed
    // joker, instead of following the spiral order.
    conditionMet: () => true,
  },
  {
    id: 'time-trial',
    name: 'Time Trial',
    synopsis: 'Twist: Finish fast for bonus points',
    goal: 'Score 500+ points while racing against the clock. Finishing in under 3 minutes earns bonus points (the faster the finish, the bigger the bonus). Taking too long results in a penalty.',
    scoreTarget: 500,
    // The adjustment is applied by the FINAL score surfaces via
    // scoring.ts's timeTrialAdjust (state.timeTrial + state.elapsedMs,
    // ticked by useGameClock). Hitting the adjusted target is the only
    // end-state check.
    conditionMet: () => true,
  },
  {
    id: 'mixed-bag',
    name: 'Mixed Bag',
    synopsis: 'Twist: One bonus slot per color',
    goal: 'Score 500+ points with bonus slots locked to categories. Slot 1 holds a green one-time action card, slot 2 a yellow in-game bonus card, and slot 3 a purple end-game bonus card.',
    scoreTarget: 500,
    // Enforced at newGame via slotCategories — placeholders seed the
    // three slots in category order, and ♣ filters draws to match.
    conditionMet: () => true,
  },
  {
    id: 'three-tricks',
    name: 'Three Tricks',
    synopsis: 'Twist: Bonus slots locked to green only',
    goal: 'Score 500+ points with no yellow/purple bonus cards. Instead, you start holding three green one-time action cards (dealt at random from the full special deck).',
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
    goal: 'Score 500+ points with no bonus cards. Instead, spending a club on its perk increases the base value of a random hand type by double its blackjack value (2–9 = face, 10–K = 10, A = 11).',
    scoreTarget: 500,
    // Enforced at newGame: noBonusCards strips the bonus deck and
    // investHands repurposes the ♣ perk to boost a random hand's base.
    conditionMet: () => true,
  },
  {
    id: 'double-duty',
    name: 'Double Duty',
    synopsis: 'Twist: Two-way cards — Flip burns 2 cards',
    goal: "Score 500+ points with a two-way deck. Every card carries a second identity printed upside-down on its bottom half. Each rank+suit appears exactly twice across the deck, paired at random each game. Flip a card to play its other half, with the cost of the next two deck cards being burned. Don't flip too many times or the deck will run out!",
    scoreTarget: 500,
    // Enforced at newGame (dual identities assigned to the deck) and by
    // the FLIP_CARD reducer guards. Hitting the score target is the only
    // end-state check.
    conditionMet: () => true,
  },
  {
    id: 'spiraling',
    name: 'Spiraling',
    // Benched while the mechanic is tuned — playable at
    // /challenges/spiraling but off the menu and the counts.
    hidden: true,
    synopsis: 'Twist: ♠ spirals a card outward by its pips',
    goal: "Score 500+ points with a rewired ♠ perk: instead of sliding, pick any card on the board and it travels OUTWARD along the spiral by the played spade's pip value (A=1, 2–10 face value, J=11, Q=12, K=13) — a card on spiral space 1, moved by a 9♠, lands on space 10. It jumps over cards along the way, but the landing space must be empty and within the spiral (space 25 is the end). Tap a card to preview its landing spot, then tap that spot to commit.",
    scoreTarget: 500,
    // Enforced at the reducer level: state.spiraling reroutes ♠ from the
    // slide flow into the spiral flow. Hitting the score target is the
    // only end-state check.
    conditionMet: () => true,
  },
  {
    id: 'draw-poker',
    name: 'Five Draw',
    synopsis: 'Twist: Build each row from a 5-card draw',
    goal: 'Score 500+ points playing five hands of 5-card draw from a single deck, with up to two drawing rounds allowed per hand. Place each completed hand into an empty row, with the cards in your preferred order. You start with 3 bonus cards, one of which is always “All Rows ×3” (every row’s score is multiplied) and the other two chosen at random. You have the option to replace a bonus card at the end of each hand.',
    scoreTarget: 500,
    // Enforced structurally at newGame (drawPoker + noBonusCards +
    // initialBonusCards): the whole run flows through the draw-select /
    // draw-place phases and never visits awaiting-action. Hitting the
    // score target is the only end-state check.
    conditionMet: () => true,
  },
  {
    id: 'nut-low',
    name: 'Nut Low',
    synopsis: 'Twist: Lines score as 2-7 lowball hands',
    goal: 'Score 400+ points with every line scoring as a deuce-to-seven lowball hand. Straights and flushes count against you, so 7-5-4-3-2 is the best line in the game. A busted line (pair or higher) or unfinished line has a penalty of -50. The deck is trimmed to 44 cards (with the joker and 8 additional cards removed at random) and there are no bonus cards. Tap hand values to view the full scoring table.',
    scoreTarget: 400,
    // 44 cards after the joker strip (noJokers in modes.ts): the joker
    // plus 8 random standards are gone before play. (Easy/Medium
    // dailies keep jokers in the random trim pool — DailyDay adjusts
    // the goal's parenthetical to match.)
    deckLimit: 44,
    // Enforced at newGame (lowball + noBonusCards + noJokers): scoring
    // swaps to the 2-7 table (src/game/lowHands.ts) and the bonus deck
    // is stripped. Hitting the score target is the only end-state check.
    conditionMet: () => true,
  },
];

// The player-facing catalog: what the Challenges page lists, what the
// beaten-out-of-N counts measure, and what "beat every Challenge" means.
// Hidden entries stay playable by direct route but don't count.
export const LIVE_CHALLENGES: Challenge[] = CHALLENGES.filter(c => !c.hidden);

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

/**
 * The challenge's goal copy adjusted to an actual RUN — shared by the
 * daily intro (DailyDay) and the in-game twist popover so the two can't
 * drift. Every goal opens with a "Score N+ points" sentence; the run's
 * real target (dailyTargetFor's difficulty-adjusted number on a daily,
 * the catalog target on the challenge route) swaps in. Nut Low's deck
 * parenthetical describes the Hard trim (joker + 8 random); Easy and
 * Medium dailies keep their jokers in the random trim pool (modes.ts),
 * so it's rewritten to the actual count: 54→44 removes 10 on Easy,
 * 53→44 removes 9 on Medium. Short Deck's removal count shifts the
 * same way: Easy's two-joker 54-card pool trims 9 to reach 45 (Medium
 * matches Hard at 8).
 */
export const goalForRun = (
  challenge: Challenge,
  target: number,
  difficulty: Difficulty
): string => {
  let goal = challenge.goal.replace(
    /^Score \d+\+ points/,
    `Score ${target}+ points`
  );
  if (
    challenge.id === 'nut-low' &&
    (difficulty === 'easy' || difficulty === 'medium')
  ) {
    const removed = difficulty === 'easy' ? 10 : 9;
    goal = goal.replace(
      '(with the joker and 8 additional cards removed at random)',
      `(with ${removed} cards removed at random, jokers included in the pool)`
    );
  }
  if (challenge.id === 'short-deck' && difficulty === 'easy') {
    goal = goal.replace(
      '8 cards are removed at random',
      '9 cards are removed at random'
    );
  }
  return goal;
};

/**
 * The daily splash's difficulty briefing sentence, made RUN-aware the
 * same way the in-game difficulty pill's rows are (GameScreen's
 * navPill): a twist can rewire the standard loop, and the briefing
 * must not contradict it. Twist-free days keep the standard
 * difficulty sentence verbatim.
 *  - Poker Purist / Nut Low / Bull Market never have bonus cards —
 *    one 'no bonus cards' clause replaces the starter + swap pair.
 *  - Five Draw and Three Tricks start holding 3; Five Draw's
 *    between-hands offer always allows swapping, Three Tricks' trio
 *    is consumed. Five Draw drops the discards clause (its redraw IS
 *    the discard) and plays with no undo.
 *  - Mixed Bag seeds empty category slots — no starter card.
 *  - The deck-trimming twists put jokers in the random trim pool, so
 *    they may not survive the cut: Short Deck at every difficulty,
 *    Nut Low on Easy/Medium ('up to N'); Nut Low's Hard trim is
 *    jokerless outright.
 *  - A No Discards day says so at every difficulty.
 */
export const runSentenceFor = (
  d: Difficulty,
  twistId: ChallengeId | null
): string => {
  if (!twistId) return difficultySentence(d, undoClauseFor(d));
  const jokers = JOKERS_BY_DIFFICULTY[d];
  const trimsJokers =
    twistId === 'short-deck' || (twistId === 'nut-low' && d !== 'hard');
  const jokerClause =
    twistId === 'nut-low' && d === 'hard'
      ? 'no jokers'
      : trimsJokers && jokers > 0
        ? jokers === 1
          ? 'up to one joker'
          : 'up to two jokers'
        : jokers === 0
          ? 'no jokers'
          : jokers === 1
            ? 'one joker'
            : 'two jokers';
  const noBonusAtAll =
    twistId === 'poker-purist' ||
    twistId === 'nut-low' ||
    twistId === 'bull-market';
  const heldTrio = twistId === 'draw-poker' || twistId === 'three-tricks';
  const bonusClauses = noBonusAtAll
    ? ['no bonus cards']
    : heldTrio
      ? [
          'three starter bonus cards',
          ...(twistId === 'draw-poker' ? ['may swap bonus cards'] : []),
        ]
      : [
          twistId === 'mixed-bag'
            ? 'no starter bonus'
            : STARTER_BONUS_BY_DIFFICULTY[d] > 0
              ? 'one starter bonus card'
              : 'no starter bonus',
          BONUS_SWAP_CLAUSE[BONUS_SWAP_AT_CAP_BY_DIFFICULTY[d]],
        ];
  const clauses = [
    jokerClause,
    ...bonusClauses,
    CAN_PREVIEW_DECK_BY_DIFFICULTY[d] ? 'deck peek on' : 'no deck peek',
    ...(twistId === 'draw-poker'
      ? []
      : [
          twistId === 'no-discards' || NO_DISCARDS_BY_DIFFICULTY[d]
            ? 'no discards'
            : 'discards on',
        ]),
    twistId === 'draw-poker' ? 'no undo' : undoClauseFor(d),
  ];
  const s = clauses.join(', ') + '.';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

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
