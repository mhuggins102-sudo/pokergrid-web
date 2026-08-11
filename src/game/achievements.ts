import { isJoker } from './cards';
import { HandRank } from './hands';
import { ScoreReport, scoreGrid, timeTrialAdjust } from './scoring';
import type { GameState } from './state';
import { LIVE_CHALLENGES } from './challenges';
import type { ChallengeId } from './challenges';
import type { Difficulty } from './rules';

// ============================================================================
// Achievements — passive accomplishments earned through play.
//
// Six tiers:
//   - 'easy-medium'  : any twist-free game on Easy or Medium — Free Play
//                      or a Daily whose recipe rolled no twist.
//   - 'hard-extreme' : same, on Hard or Extreme.
//   - 'daily'        : cumulative across Daily Puzzle plays.
//   - 'challenge'    : Challenge-flavored goals (catalog sweep + trophy
//                      counters) — earnable from Challenge runs.
//   - 'variant'      : single-run feats scoped to one specific twist
//                      (variantId) — earnable from that Challenge run or
//                      a Daily carrying the same twist.
//   - 'milestone'    : longer-term cumulative goals (wins across modes,
//                      etc.) plus a couple of one-shot prowess
//                      achievements that don't fit a single-difficulty
//                      tier.
//
// Targets Up contributes to milestones but doesn't have its own tier set.
//
// Every achievement has:
//   - id: stable string saved into stats.achievementsDone
//   - tier: gates how the run / stats are checked
//   - name / description: shown on the AchievementsScreen and the result-
//     screen "earned" callout. The Achievements page renders the tier as
//     a section header, so descriptions DON'T repeat the difficulty.
//   - scoreTarget?: minimum score for the run to qualify (tiered only).
//   - conditionMet: checks the run / cumulative state.
// ============================================================================

export type AchievementTier =
  | 'easy-medium'
  | 'hard-extreme'
  | 'daily'
  | 'challenge'
  | 'variant'
  | 'milestone';

// Pair, Two Pair, and Three of a Kind — and anything that scored nothing
// (no hand). Used by the Low Hands achievement.
const LOW_OR_NONE: Set<HandRank> = new Set<HandRank>([
  'HIGH_CARD',
  'PAIR',
  'TWO_PAIR',
  'THREE_OF_A_KIND',
]);

// Retired ids ('easy-overshot', 'easy-soloist') may linger in saved
// stats.achievementsDone — they stay there (and keep their one-time XP)
// but no longer render anywhere, since every surface filters through
// this catalog.
export type AchievementId =
  | 'balanced'
  | 'dynamite'
  | 'jokerless'
  | 'no-swap'
  | 'grid-only'
  | 'line-only'
  | 'low-hands'
  | 'high-hands'
  | 'gaps-and-glory'
  | 'full-spectrum'
  | 'easy-grand'
  | 'easy-waste-not'
  | 'easy-triple-crown'
  // Daily puzzles
  | 'daily-first'
  | 'daily-20'
  | 'daily-streak-3'
  | 'daily-streak-10'
  // Challenges (ids keep their original threshold suffixes — they're
  // saved into stats.achievementsDone, so they stay stable even though
  // the requirements have since been raised)
  | 'all-challenges'
  | 'challenge-trophies-5'
  | 'challenge-golds-3'
  // Variants (per-twist single-run feats)
  | 'variant-bull-market'
  | 'variant-time-trial'
  | 'variant-double-duty'
  // Milestones
  | 'win-every-difficulty'
  | 'perfect-every-difficulty'
  | 'wins-25'
  | 'wins-100'
  | 'full-bonus-hand';

// Minimal subset of stats / run data the milestone-tier conditions need.
// Filled in by ResultScreen against the post-run stats, so e.g. the
// "win 25 games" milestone fires when the qualifying run pushes the
// total past the threshold. Separating this from the raw Stats type
// keeps src/game/ from importing src/ui/.
export interface MilestoneInputs {
  // Per-difficulty Free Play wins (post-run).
  winsByDifficulty: Record<Difficulty, number>;
  // Per-difficulty SS-tier Free Play wins (post-run).
  ssByDifficulty: Record<Difficulty, number>;
  // Total Free Play wins across all difficulties (post-run).
  totalWins: number;
  // Number of completed Challenges and the size of the catalog.
  challengesCompleted: number;
  totalChallenges: number;
  // Challenge trophy counts (post-run, live catalog only): silver-or-
  // better (S / SS win tiers) and gold (SS) across distinct challenges.
  challengeSilverPlus: number;
  challengeGold: number;
  // Per-card Shapley contribution for the held bonus cards on this
  // run. Index-aligned with state.bonusCards.
  runBonusShapley: number[];
  // True if the current run was a Free Play context (vs Targets Up or
  // Challenge). Milestones that only fire on Free Play wins use this.
  runWasFreePlay: boolean;
  // How many distinct cards from BONUS_DECK_POOL have ever scored
  // (Shapley > 0) including the current run, and the size of the
  // pool itself. The Full Slate milestone fires when these match.
  uniqueBonusCardsScored: number;
  totalBonusCardsInPool: number;
}

export interface AchievementCheckCtx {
  state: GameState;
  report: ScoreReport;
  milestone: MilestoneInputs;
  // Which play mode produced this run. Which tiers a mode can award is
  // decided by modeAllowedFor below.
  mode: 'free' | 'targets-up' | 'challenge' | 'daily';
  // The variant shaping this run, if any: the Challenge's own id on a
  // Challenge run, the recipe twist on a twisted Daily. Null on Free
  // Play and twist-free Dailies.
  activeVariant: ChallengeId | null;
}

export interface Achievement {
  id: AchievementId;
  tier: AchievementTier;
  name: string;
  description: string;
  // Optional — undefined for milestones whose floor isn't a single
  // per-run score.
  scoreTarget?: number;
  // Variant tier only: the twist this achievement is scoped to. The run
  // qualifies when its activeVariant matches — that Challenge itself or
  // a Daily carrying the same twist.
  variantId?: ChallengeId;
  conditionMet: (ctx: AchievementCheckCtx) => boolean;
}

// Points the Bull Market ♣ invest perk contributed to the final score:
// the full report minus a re-score of the same board without the
// accumulated handBoost. The options mirror the final-report options the
// result surfaces pass, so the diff is exact even if a future variant
// combines invests with bonus cards or the clock.
const investedPoints = (state: GameState, report: ScoreReport): number => {
  if (Object.keys(state.handBoost ?? {}).length === 0) return 0;
  const without = scoreGrid(state.grid, state.bonusCards, {
    deckRemaining: state.deck.length,
    discards: state.discards,
    perkSpent: state.perkSpent,
    timeAdjust: timeTrialAdjust(state),
  });
  return report.total - without.total;
};

export const ACHIEVEMENTS: Achievement[] = [
  // ---------- Easy / Medium tier ----------
  {
    id: 'easy-grand',
    tier: 'easy-medium',
    name: 'Grand',
    description: 'Score 1000+ points.',
    scoreTarget: 1000,
    conditionMet: () => true,
  },
  {
    id: 'easy-waste-not',
    tier: 'easy-medium',
    name: 'Waste Not',
    description: 'Score 750+ with 15+ cards still in the deck at game end.',
    scoreTarget: 750,
    conditionMet: ({ state }) => state.deck.length >= 15,
  },
  {
    id: 'easy-triple-crown',
    tier: 'easy-medium',
    name: 'Triple Crown',
    description: 'Score 750+ with 3+ straight or royal flushes on the grid.',
    scoreTarget: 750,
    conditionMet: ({ report }) =>
      report.lines.filter(
        l => l.hand === 'STRAIGHT_FLUSH' || l.hand === 'ROYAL_FLUSH'
      ).length >= 3,
  },

  // ---------- Hard / Extreme tier ----------
  {
    id: 'dynamite',
    tier: 'hard-extreme',
    name: 'Dynamite',
    description: 'Score 500+ with at least one row or column worth 300+.',
    scoreTarget: 500,
    conditionMet: ({ report }) => report.lines.some(l => l.total >= 300),
  },
  {
    id: 'line-only',
    tier: 'hard-extreme',
    name: 'Line Only',
    description: 'Score 500+ holding no end-of-game multiplier bonus cards.',
    scoreTarget: 500,
    conditionMet: ({ state }) =>
      state.bonusCards.length > 0 &&
      state.bonusCards.every(c => !c.gridEffect),
  },
  {
    id: 'grid-only',
    tier: 'hard-extreme',
    name: 'Grid Only',
    description: 'Score 500+ holding only end-of-game multiplier bonus cards.',
    scoreTarget: 500,
    conditionMet: ({ state }) =>
      state.bonusCards.length > 0 &&
      state.bonusCards.every(c => !c.lineEffect),
  },
  {
    id: 'balanced',
    tier: 'hard-extreme',
    name: 'Balanced',
    description: 'Score 500+ without any single row or column worth 100+.',
    scoreTarget: 500,
    conditionMet: ({ report }) => report.lines.every(l => l.total < 100),
  },
  {
    id: 'jokerless',
    tier: 'hard-extreme',
    name: 'Jokerless',
    description: 'Score 500+ with no joker on the grid at game end.',
    scoreTarget: 500,
    conditionMet: ({ state }) =>
      !state.grid.some(c => c !== null && isJoker(c)),
  },
  {
    id: 'no-swap',
    tier: 'hard-extreme',
    name: 'No Swap',
    description: 'Score 500+ without swapping out a bonus card at the cap.',
    scoreTarget: 500,
    conditionMet: ({ state }) => !state.swappedBonus,
  },
  {
    id: 'high-hands',
    tier: 'hard-extreme',
    name: 'High Hands',
    description:
      'Score 500+ with every scoring line a Three of a Kind or higher (High Card lines don\'t count against).',
    scoreTarget: 500,
    conditionMet: ({ report }) =>
      report.lines.every(l => l.hand !== 'PAIR' && l.hand !== 'TWO_PAIR'),
  },
  {
    id: 'low-hands',
    tier: 'hard-extreme',
    name: 'Low Hands',
    description: 'Score 500+ with no line scoring higher than Three of a Kind.',
    scoreTarget: 500,
    conditionMet: ({ report }) =>
      report.lines.every(l => !l.hand || LOW_OR_NONE.has(l.hand)),
  },
  {
    id: 'gaps-and-glory',
    tier: 'hard-extreme',
    name: 'Gaps & Glory',
    description: 'Score 500+ with 3 or more incomplete lines on the board.',
    scoreTarget: 500,
    conditionMet: ({ report }) =>
      report.lines.filter(l => l.incomplete).length >= 3,
  },
  {
    id: 'full-spectrum',
    tier: 'hard-extreme',
    name: 'Full Spectrum',
    description: 'Score 500+ with 8 or more distinct scoring hand types.',
    scoreTarget: 500,
    conditionMet: ({ report }) =>
      new Set(
        report.lines
          .map(l => l.hand)
          .filter((h): h is HandRank => h !== null && h !== 'HIGH_CARD')
      ).size >= 8,
  },

  // ---------- Daily puzzles ----------
  // These are cumulative across all daily plays, so they're recorded by
  // earnedCumulativeAchievements (driven from the daily plays map), not
  // by the per-run engine below. conditionMet is never invoked for them.
  // Two writers share that check: useRecordResult's daily branch (which
  // also surfaces the end-of-game 🏆 toast) and useSyncDailyAchievements
  // (silent catch-up for pre-feature / synced-in plays).
  {
    id: 'daily-first',
    tier: 'daily',
    name: 'Daily Debut',
    description: 'Win your first daily puzzle.',
    conditionMet: () => false,
  },
  {
    id: 'daily-20',
    tier: 'daily',
    name: 'Daily Devotee',
    description: 'Win 20 daily puzzles.',
    conditionMet: () => false,
  },
  {
    id: 'daily-streak-3',
    tier: 'daily',
    name: 'On a Roll',
    description: 'Win 3+ daily puzzles in a row (consecutive dates).',
    conditionMet: () => false,
  },
  {
    id: 'daily-streak-10',
    tier: 'daily',
    name: 'Perfect Fortnight',
    description: 'Win 10+ daily puzzles in a row (consecutive dates).',
    conditionMet: () => false,
  },

  // ---------- Challenges ----------
  {
    id: 'all-challenges',
    tier: 'challenge',
    name: 'Challenge Sweep',
    description: 'Beat every Challenge.',
    conditionMet: ({ milestone }) =>
      milestone.challengesCompleted >= milestone.totalChallenges,
  },
  {
    id: 'challenge-trophies-5',
    tier: 'challenge',
    name: 'Trophy Case',
    description:
      'Earn silver or gold trophies (S or SS wins) on 5 different Challenges.',
    conditionMet: ({ milestone }) => milestone.challengeSilverPlus >= 5,
  },
  {
    id: 'challenge-golds-3',
    tier: 'challenge',
    name: 'Gold Standard',
    description: 'Earn gold trophies (SS wins) on 3 different Challenges.',
    conditionMet: ({ milestone }) => milestone.challengeGold >= 3,
  },

  // ---------- Variants ----------
  // Single-run feats inside one specific twist — the Challenge run or a
  // Daily whose recipe rolled the same twist (variantId gating).
  {
    id: 'variant-bull-market',
    tier: 'variant',
    variantId: 'bull-market',
    name: 'Bull Run',
    description:
      'Bull Market — score 500+ with 300+ points coming from ♣ investments.',
    scoreTarget: 500,
    conditionMet: ({ state, report }) => investedPoints(state, report) >= 300,
  },
  {
    id: 'variant-time-trial',
    tier: 'variant',
    variantId: 'time-trial',
    name: 'Lightning Round',
    description: 'Time Trial — score 500+ finishing in under 1:30.',
    scoreTarget: 500,
    conditionMet: ({ state }) => state.elapsedMs < 90_000,
  },
  {
    id: 'variant-double-duty',
    tier: 'variant',
    variantId: 'double-duty',
    name: 'Flipping Out',
    description: 'Double Duty — score 500+ with 10 or more cards flipped.',
    scoreTarget: 500,
    // Every flip burns exactly two deck cards (the reducer refuses a
    // flip when fewer than 2 remain), and UNDO restores them — so
    // burned.length / 2 is the honest flip count.
    conditionMet: ({ state }) => state.burned.length >= 20,
  },

  // ---------- Milestones ----------
  {
    id: 'win-every-difficulty',
    tier: 'milestone',
    name: 'Globetrotter',
    description: 'Win a game at each difficulty (free play or daily).',
    conditionMet: ({ milestone }) => {
      const w = milestone.winsByDifficulty;
      return w.easy > 0 && w.medium > 0 && w.hard > 0 && w.extreme > 0;
    },
  },
  {
    id: 'perfect-every-difficulty',
    tier: 'milestone',
    name: 'Perfectionist',
    description:
      'Win with Perfect (SS rating) at each difficulty (free play or daily).',
    conditionMet: ({ milestone }) => {
      const s = milestone.ssByDifficulty;
      return s.easy > 0 && s.medium > 0 && s.hard > 0 && s.extreme > 0;
    },
  },
  {
    id: 'wins-25',
    tier: 'milestone',
    name: 'Quarter Century',
    description: 'Win 25+ games, free play and daily puzzles combined.',
    conditionMet: ({ milestone }) => milestone.totalWins >= 25,
  },
  {
    id: 'wins-100',
    tier: 'milestone',
    name: 'Centurion',
    description: 'Win 100+ games, free play and daily puzzles combined.',
    conditionMet: ({ milestone }) => milestone.totalWins >= 100,
  },
  {
    id: 'full-bonus-hand',
    tier: 'milestone',
    name: 'Full Slate',
    description: 'Score points with every bonus card at least once.',
    conditionMet: ({ milestone }) =>
      milestone.uniqueBonusCardsScored >= milestone.totalBonusCardsInPool,
  },
];

export const findAchievement = (id: AchievementId): Achievement | undefined =>
  ACHIEVEMENTS.find(a => a.id === id);

// Size of the LIVE Challenge catalog (hidden entries don't count),
// exposed for milestone bookkeeping so callers don't need to import
// the catalog directly.
export const CHALLENGES_TOTAL = LIVE_CHALLENGES.length;

// Which runs can award which tiers:
//   - easy-medium / hard-extreme: any twist-free run — Free Play or a
//     Daily whose recipe rolled no twist. The activeVariant check also
//     keeps them off Challenge runs (every Challenge runs on the Hard
//     ruleset AND is itself a variant).
//   - challenge: Free Play or Challenge runs — the trophy counters'
//     qualifying event IS a Challenge win.
//   - variant: only a run carrying the matching twist — that Challenge
//     itself or a Daily with the same twist in its recipe.
//   - milestone: Free Play only (the daily path reaches the same
//     milestones through earnedCumulativeAchievements).
const modeAllowedFor = (
  ach: Achievement,
  ctx: AchievementCheckCtx
): boolean => {
  const { mode, activeVariant } = ctx;
  // Daily-tier achievements are cumulative over the plays map, recorded
  // by earnedCumulativeAchievements — never by the per-run engine.
  if (ach.tier === 'daily') return false;
  if (ach.tier === 'challenge') {
    return mode === 'free' || mode === 'challenge';
  }
  if (ach.tier === 'variant') {
    return (
      (mode === 'challenge' || mode === 'daily') &&
      ach.variantId !== undefined &&
      activeVariant === ach.variantId
    );
  }
  if (ach.tier === 'milestone') return mode === 'free';
  // easy-medium / hard-extreme
  return (mode === 'free' || mode === 'daily') && activeVariant === null;
};

// Earned iff the achievement's tier-specific gating passes AND the
// per-tier condition fires. Easy-Medium / Hard-Extreme tiers require a
// matching difficulty plus a score floor; Challenges and Milestones run
// the condition directly and ignore per-difficulty / score gating;
// Variants add their own score floor on top of the twist match.
export const achievementEarned = (
  ach: Achievement,
  ctx: AchievementCheckCtx
): boolean => {
  const { state, report } = ctx;
  if (!modeAllowedFor(ach, ctx)) return false;
  if (
    ach.tier === 'easy-medium' &&
    state.difficulty !== 'easy' &&
    state.difficulty !== 'medium'
  ) {
    return false;
  }
  if (
    ach.tier === 'hard-extreme' &&
    state.difficulty !== 'hard' &&
    state.difficulty !== 'extreme'
  ) {
    return false;
  }
  if (ach.scoreTarget !== undefined && report.total < ach.scoreTarget) {
    return false;
  }
  return ach.conditionMet(ctx);
};

// Cumulative tallies that aren't tied to a single run: the Daily-Puzzle
// achievements and the combined-win milestones. Kept here (pure, with
// the thresholds) so they live alongside the achievement catalog and
// stay testable; the UI feeds in the daily plays + free-play wins.
export interface CumulativeInputs {
  // Daily puzzles won (all-time) and the longest consecutive-date streak.
  dailyWins: number;
  dailyBestStreak: number;
  // Free-play wins + daily wins — the combined total the win milestones
  // now count.
  totalWins: number;
  // Combined free-play + daily wins / SS-tier wins per difficulty — feed
  // the Globetrotter and Perfectionist milestones (so dailies count too).
  winsByDifficulty: Record<Difficulty, number>;
  ssByDifficulty: Record<Difficulty, number>;
}

const allFourPositive = (m: Record<Difficulty, number>): boolean =>
  m.easy > 0 && m.medium > 0 && m.hard > 0 && m.extreme > 0;

export const earnedCumulativeAchievements = (
  c: CumulativeInputs
): AchievementId[] => {
  const out: AchievementId[] = [];
  if (c.dailyWins >= 1) out.push('daily-first');
  if (c.dailyWins >= 20) out.push('daily-20');
  if (c.dailyBestStreak >= 3) out.push('daily-streak-3');
  if (c.dailyBestStreak >= 10) out.push('daily-streak-10');
  if (c.totalWins >= 25) out.push('wins-25');
  if (c.totalWins >= 100) out.push('wins-100');
  if (allFourPositive(c.winsByDifficulty)) out.push('win-every-difficulty');
  if (allFourPositive(c.ssByDifficulty)) out.push('perfect-every-difficulty');
  return out;
};
