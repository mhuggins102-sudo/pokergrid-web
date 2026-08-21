import { AchievementId } from '../../game/achievements';
import { BONUS_DECK_POOL } from '../../game/bonusCards';
import { LIVE_CHALLENGES } from '../../game/challenges';
import type { Difficulty } from '../../game/rules';
import type { Stats } from '../../lib/stats';
import type { DailyPlaysMap } from '../daily/sync/playsStore';
import { cumulativeInputsFrom } from '../progress/cumulativeInputs';

/*
 * Progress copy for the achievements whose requirements accumulate
 * across games — surfaced in the unearned-card popovers on the
 * Achievements page. The counting mirrors the award paths exactly:
 * cumulativeInputsFrom for the daily / total-win / per-difficulty
 * milestones (wins across every mode) and the per-run milestone
 * builder (useRecordResult) for the challenge and bonus-card ones.
 * Single-run feats have no meaningful "progress" and get no entry.
 */

export interface AchievementProgress {
  /** Main progress line, e.g. "12 / 20 daily puzzles won". */
  text: string;
  /** Optional second line (Full Slate's remaining-card names). */
  detail?: string;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
};

/** Within this many unscored cards, Full Slate names the stragglers. */
const FULL_SLATE_NEAR = 5;

export function achievementProgressMap(
  stats: Stats,
  plays: DailyPlaysMap
): Partial<Record<AchievementId, AchievementProgress>> {
  const c = cumulativeInputsFrom(plays, stats);
  const out: Partial<Record<AchievementId, AchievementProgress>> = {};

  // Daily Devotee / Perfect Fortnight (best CALENDAR streak of won dates).
  out['daily-20'] = { text: `${c.dailyWins} / 20 daily puzzles won` };
  out['daily-streak-10'] = {
    text: `Best streak: ${c.dailyBestStreak} daily ${
      c.dailyBestStreak === 1 ? 'win' : 'wins'
    } in a row — need 10`,
  };

  // Challenge Sweep / Trophy Case / Gold Standard, over the LIVE catalog
  // only (a stored win on a since-hidden challenge mustn't count).
  const beaten = stats.challengesDone.filter(id =>
    LIVE_CHALLENGES.some(ch => ch.id === id)
  ).length;
  out['all-challenges'] = {
    text: `${beaten} / ${LIVE_CHALLENGES.length} challenges beaten`,
  };
  const silverPlus = LIVE_CHALLENGES.filter(ch => {
    const t = stats.challengeTiers[ch.id];
    return t === 'SS' || t === 'S';
  }).length;
  out['challenge-trophies-5'] = {
    text: `${silverPlus} / 7 challenges at silver or gold`,
  };
  const golds = LIVE_CHALLENGES.filter(
    ch => stats.challengeTiers[ch.id] === 'SS'
  ).length;
  out['challenge-golds-3'] = { text: `${golds} / 4 gold trophies` };

  // Globetrotter / Perfectionist list what's MISSING. An empty list means
  // the sync pass is about to award it — no entry rather than a blank.
  const noWin = DIFFICULTIES.filter(d => c.winsByDifficulty[d] === 0);
  if (noWin.length > 0) {
    out['win-every-difficulty'] = {
      text: `No win yet at: ${noWin.map(d => DIFF_LABEL[d]).join(', ')}`,
    };
  }
  const noSS = DIFFICULTIES.filter(d => c.ssByDifficulty[d] === 0);
  if (noSS.length > 0) {
    out['perfect-every-difficulty'] = {
      text: `No SS win yet at: ${noSS.map(d => DIFF_LABEL[d]).join(', ')}`,
    };
  }

  out['wins-25'] = { text: `${c.totalWins} / 25 wins` };
  out['wins-100'] = { text: `${c.totalWins} / 100 wins` };

  // Full Slate. Intersecting with the pool keeps stale ids in
  // bonusCardStats from inflating the count, and the remaining-names
  // list falls out of the same filter.
  const unscored = BONUS_DECK_POOL.filter(
    card => (stats.bonusCardStats[card.id]?.totalShapley ?? 0) <= 0
  );
  const scored = BONUS_DECK_POOL.length - unscored.length;
  out['full-bonus-hand'] = {
    text: `${scored} / ${BONUS_DECK_POOL.length} bonus cards scored`,
    ...(unscored.length > 0 && unscored.length <= FULL_SLATE_NEAR
      ? {
          detail: `Still needed: ${unscored
            .map(card => card.title)
            .join(', ')}`,
        }
      : {}),
  };

  return out;
}
