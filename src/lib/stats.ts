import type { AchievementId } from '../game/achievements';
import { CHALLENGES } from '../game/challenges';
import type { ChallengeId } from '../game/challenges';
import type { Difficulty } from '../game/rules';

// Pure stats logic ported from the original repo's src/ui/stats.ts —
// storage and React stripped out (the zustand store owns those now).

// IDs that used to live as Challenges but are now Achievements. Used
// at load time to migrate entries out of stats.challengesDone and into
// stats.achievementsDone — players don't lose progress just because
// the categorization changed.
const MIGRATED_ACHIEVEMENT_IDS: ReadonlySet<string> = new Set([
  'balanced',
  'dynamite',
  'jokerless',
  'no-swap',
  'grid-only',
  'line-only',
  'low-hands',
  'high-hands',
]);

// Derived from the live catalog so a newly added challenge can never be
// filtered out of stats.challengesDone at load time.
const KNOWN_CHALLENGE_IDS: ReadonlySet<string> = new Set(
  CHALLENGES.map(c => c.id)
);

export interface BonusCardAttribution {
  cardId: string;
  shapley: number;
}

export interface RunRecord {
  ts: number; // Date.now()
  difficulty: Difficulty;
  score: number;
  target: number;
  won: boolean;
  bonusCards?: BonusCardAttribution[];
}

export interface DifficultyStat {
  best: number | null;
  totalScore: number;
  totalRuns: number;
  wins: number;
  bestStreak: number;
  currentStreak: number;
}

const emptyDifficultyStat = (): DifficultyStat => ({
  best: null,
  totalScore: 0,
  totalRuns: 0,
  wins: 0,
  bestStreak: 0,
  currentStreak: 0,
});

export interface BonusCardStat {
  timesHeld: number;
  totalShapley: number;
}

// Six tiers — result-screen banner + the stats histogram.
export type Tier = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

export const TIER_ORDER: Tier[] = ['SS', 'S', 'A', 'B', 'C', 'D'];

const emptyTierCounts = (): Record<Tier, number> => ({
  SS: 0, S: 0, A: 0, B: 0, C: 0, D: 0,
});

export const tierForRun = (run: Pick<RunRecord, 'score' | 'target' | 'won'>): Tier => {
  const ratio = run.score / Math.max(1, run.target);
  if (run.won) {
    if (ratio >= 1.6) return 'SS';
    if (ratio >= 1.3) return 'S';
    return 'A';
  }
  if (ratio >= 0.85) return 'B';
  if (ratio >= 0.5) return 'C';
  return 'D';
};

export interface Stats {
  best: Record<Difficulty, number | null>;
  wins: number;
  losses: number;
  streak: number;
  longestStreak: number;
  // Rolling buffer of the most recent runs (newest first).
  recent: RunRecord[];
  // Per-difficulty roll-up of every completed run.
  byDifficulty: Record<Difficulty, DifficultyStat>;
  // Highest Targets-Up level reached, and completed Challenges.
  targetsUpBest: number;
  challengesDone: ChallengeId[];
  achievementsDone: AchievementId[];
  // All-time bonus-card attribution, keyed by base card id.
  bonusCardStats: Record<string, BonusCardStat>;
  bonusCardStatsByDifficulty: Record<Difficulty, Record<string, BonusCardStat>>;
  // Per-difficulty histogram of tier outcomes.
  tierCounts: Record<Difficulty, Record<Tier, number>>;
}

export const RECENT_RUNS_CAP = 20;

export const EMPTY_STATS: Stats = {
  best: { easy: null, medium: null, hard: null, extreme: null },
  wins: 0,
  losses: 0,
  streak: 0,
  longestStreak: 0,
  recent: [],
  byDifficulty: {
    easy: emptyDifficultyStat(),
    medium: emptyDifficultyStat(),
    hard: emptyDifficultyStat(),
    extreme: emptyDifficultyStat(),
  },
  targetsUpBest: 0,
  challengesDone: [],
  achievementsDone: [],
  bonusCardStats: {},
  bonusCardStatsByDifficulty: { easy: {}, medium: {}, hard: {}, extreme: {} },
  tierCounts: {
    easy: emptyTierCounts(),
    medium: emptyTierCounts(),
    hard: emptyTierCounts(),
    extreme: emptyTierCounts(),
  },
};

const mergeByDifficultyMap = <T>(
  parsed: Partial<Record<Difficulty, T>> | undefined,
  defaultFor: () => T
): Record<Difficulty, T> => ({
  easy: parsed?.easy ?? defaultFor(),
  medium: parsed?.medium ?? defaultFor(),
  hard: parsed?.hard ?? defaultFor(),
  extreme: parsed?.extreme ?? defaultFor(),
});

/**
 * Hydrate a possibly-old persisted blob into a full Stats value,
 * including the challenges→achievements migration. Used as the persist
 * merge function.
 */
export const hydrateStats = (parsed: Partial<Stats> | undefined): Stats => {
  if (!parsed) return EMPTY_STATS;
  const oldChallenges = (parsed.challengesDone ?? []) as string[];
  const migratedAchievements = oldChallenges.filter(id =>
    MIGRATED_ACHIEVEMENT_IDS.has(id)
  ) as AchievementId[];
  const survivingChallenges = oldChallenges.filter(id =>
    KNOWN_CHALLENGE_IDS.has(id)
  ) as ChallengeId[];
  const achievementsDone = Array.from(
    new Set<AchievementId>([
      ...migratedAchievements,
      ...((parsed.achievementsDone ?? []) as AchievementId[]),
    ])
  );
  return {
    ...EMPTY_STATS,
    ...parsed,
    best: { ...EMPTY_STATS.best, ...parsed.best },
    byDifficulty: {
      easy: { ...emptyDifficultyStat(), ...parsed.byDifficulty?.easy },
      medium: { ...emptyDifficultyStat(), ...parsed.byDifficulty?.medium },
      hard: { ...emptyDifficultyStat(), ...parsed.byDifficulty?.hard },
      extreme: { ...emptyDifficultyStat(), ...parsed.byDifficulty?.extreme },
    },
    bonusCardStats: parsed.bonusCardStats ?? {},
    bonusCardStatsByDifficulty: mergeByDifficultyMap(
      parsed.bonusCardStatsByDifficulty,
      () => ({})
    ),
    tierCounts: {
      easy: { ...emptyTierCounts(), ...parsed.tierCounts?.easy },
      medium: { ...emptyTierCounts(), ...parsed.tierCounts?.medium },
      hard: { ...emptyTierCounts(), ...parsed.tierCounts?.hard },
      extreme: { ...emptyTierCounts(), ...parsed.tierCounts?.extreme },
    },
    challengesDone: survivingChallenges,
    achievementsDone,
  };
};

export const recordRun = (prev: Stats, run: RunRecord): Stats => {
  const bestNow = prev.best[run.difficulty];
  const newBest = bestNow === null || run.score > bestNow ? run.score : bestNow;
  const wins = prev.wins + (run.won ? 1 : 0);
  const losses = prev.losses + (run.won ? 0 : 1);
  const streak = run.won ? prev.streak + 1 : 0;
  const longestStreak = Math.max(prev.longestStreak, streak);
  const recent = [run, ...prev.recent].slice(0, RECENT_RUNS_CAP);

  const diffPrev = prev.byDifficulty[run.difficulty];
  const newCurrentStreak = run.won ? diffPrev.currentStreak + 1 : 0;
  const diffNext: DifficultyStat = {
    best: newBest,
    totalScore: diffPrev.totalScore + run.score,
    totalRuns: diffPrev.totalRuns + 1,
    wins: diffPrev.wins + (run.won ? 1 : 0),
    currentStreak: newCurrentStreak,
    bestStreak: Math.max(diffPrev.bestStreak, newCurrentStreak),
  };

  // Fold per-card attribution into BOTH the all-time global aggregate
  // and the per-difficulty aggregate.
  const bonusCardStats = { ...prev.bonusCardStats };
  const perDiffBonus = { ...prev.bonusCardStatsByDifficulty[run.difficulty] };
  if (run.bonusCards) {
    for (const { cardId, shapley } of run.bonusCards) {
      const cur = bonusCardStats[cardId] ?? { timesHeld: 0, totalShapley: 0 };
      bonusCardStats[cardId] = {
        timesHeld: cur.timesHeld + 1,
        totalShapley: cur.totalShapley + shapley,
      };
      const curD = perDiffBonus[cardId] ?? { timesHeld: 0, totalShapley: 0 };
      perDiffBonus[cardId] = {
        timesHeld: curD.timesHeld + 1,
        totalShapley: curD.totalShapley + shapley,
      };
    }
  }

  const tier = tierForRun(run);
  const tierPrev = prev.tierCounts[run.difficulty];
  const tierNext = { ...tierPrev, [tier]: tierPrev[tier] + 1 };

  return {
    ...prev,
    best: { ...prev.best, [run.difficulty]: newBest },
    wins,
    losses,
    streak,
    longestStreak,
    recent,
    byDifficulty: { ...prev.byDifficulty, [run.difficulty]: diffNext },
    bonusCardStats,
    bonusCardStatsByDifficulty: {
      ...prev.bonusCardStatsByDifficulty,
      [run.difficulty]: perDiffBonus,
    },
    tierCounts: { ...prev.tierCounts, [run.difficulty]: tierNext },
  };
};
