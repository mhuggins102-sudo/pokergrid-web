import { Link } from 'react-router';
import type { Challenge } from '../../game/challenges';
import type { DailyRecipe } from '../../game/daily/recipe';
import { currentDateISO } from '../../game/daily/seed';
import {
  CAN_PREVIEW_DECK_BY_DIFFICULTY,
  Difficulty,
  JOKERS_BY_DIFFICULTY,
  STARTER_BONUS_BY_DIFFICULTY,
} from '../../game/rules';
import { difficultyColors } from '../../design/tokens';
import { useTier } from '../../app/useTier';
import { DAILY_LAUNCH_ISO, dayMs, toUTC } from './dailyDates';
import { useDailyStreak } from './useDailyStreak';
import styles from './DailyIntro.module.css';

/*
 * The daily intro at every tier (phase 3 convergence) — the mockup's
 * newspaper masthead card (design-refs/desktop/Daily.dc.html): issue
 * number + "The Daily Grid", the difficulty/target briefing, today's
 * twist, the streak box with its week of dots, and the play CTA.
 * Rendered by DailyDay for any unplayed date; the streak box only
 * shows for TODAY's puzzle (its copy is about keeping today alive).
 */

export interface DailyIntroProps {
  dateISO: string;
  recipe: DailyRecipe;
  twist: Challenge | null;
  /** Target-adjusted goal copy (DailyDay computes it). */
  twistGoal: string | null;
  target: number;
  onPlay: () => void;
}

// Derived from the same rules tables the engine reads; every daily
// additionally grants one free undo (modes.ts), so the mockup's "no
// undo" clause is corrected to the real rule.
const diffDescription = (d: Difficulty): string => {
  const jokers = JOKERS_BY_DIFFICULTY[d];
  return (
    [
      jokers === 0 ? 'No jokers' : jokers === 1 ? 'One joker' : `${jokers} jokers`,
      STARTER_BONUS_BY_DIFFICULTY[d] > 0 ? 'a starter bonus card' : 'no starter card',
      CAN_PREVIEW_DECK_BY_DIFFICULTY[d] ? 'deck peek allowed' : 'no peek',
      'one free undo',
    ].join(', ') + '.'
  );
};

// "Thursday, July 9, 2026" — from ISO parts (timezone-safe).
const longDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const issueNumber = (iso: string): number =>
  Math.round((toUTC(iso) - toUTC(DAILY_LAUNCH_ISO)) / dayMs) + 1;

export function DailyIntro({
  dateISO,
  recipe,
  twist,
  twistGoal,
  target,
  onPlay,
}: DailyIntroProps) {
  const isToday = dateISO === currentDateISO();
  const streak = useDailyStreak();
  const isPhone = useTier() === 'phone';
  const tone = difficultyColors[recipe.difficulty];

  const streakSub = streak.playedToday
    ? `Played today · best ${streak.best}`
    : streak.current > 0
      ? `Play today to keep it alive · best ${streak.best}`
      : `Play today to start one · best ${streak.best}`;

  return (
    <div className={styles.wrap}>
      <article className={styles.card}>
        <div className={styles.masthead}>
          <div className={styles.issue}>No. {issueNumber(dateISO)}</div>
          <div className={styles.title}>The Daily Grid</div>
          <div className={styles.dateline}>{longDate(dateISO)}</div>
        </div>

        <div className={styles.body}>
          <div className={styles.briefing}>
            <div className={styles.brief}>
              <span className={styles.briefLabel}>Difficulty</span>
              <span className={styles.briefDiff} style={{ color: tone }}>
                <span
                  className={styles.briefDot}
                  style={{ background: tone }}
                  aria-hidden="true"
                />
                {recipe.difficulty}
              </span>
              <span className={styles.briefNote}>
                {diffDescription(recipe.difficulty)}
              </span>
            </div>
            <div className={styles.brief}>
              <span className={styles.briefLabel}>Target</span>
              <span className={styles.briefValue}>{target}</span>
              <span className={styles.briefNote}>
                Same board and deal for every player.
              </span>
            </div>
          </div>

          {twist && (
            <div className={styles.twist}>
              <span className={styles.twistIcon} aria-hidden="true">
                ✦
              </span>
              <div>
                <div className={styles.twistHead}>
                  <span className={styles.twistKicker}>
                    {isToday ? "Today's twist" : 'The twist'}
                  </span>
                  <span className={styles.twistName}>{twist.name}</span>
                </div>
                <div className={styles.twistGoal}>
                  {/* Phone: the brief synopsis only; the target-adjusted
                      goal sentence stays ≥768. */}
                  {isPhone
                    ? twist.synopsis.replace(/^Twist:\s*/i, '')
                    : (twistGoal ?? twist.goal)}
                </div>
              </div>
            </div>
          )}

          {isToday && (
            <div className={styles.streak}>
              <div className={styles.streakLeft}>
                <span className={styles.streakFlame} aria-hidden="true">
                  🔥
                </span>
                <div>
                  <div className={styles.streakTitle}>
                    {streak.current}-day streak
                  </div>
                  <div className={styles.streakSub}>{streakSub}</div>
                </div>
              </div>
              <div className={styles.week}>
                {streak.week.map(d => (
                  <div key={d.dateISO} className={styles.weekDay}>
                    <span
                      className={[
                        styles.weekDot,
                        d.played ? styles.weekDotPlayed : null,
                        !d.played && d.isToday ? styles.weekDotToday : null,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                    <span className={styles.weekLabel}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" className={styles.cta} onClick={onPlay}>
            {isToday ? "Play today's puzzle" : 'Play this puzzle'}{' '}
            <span aria-hidden="true">→</span>
          </button>
          <div className={styles.archiveRow}>
            <Link to="/daily/archive" className={styles.archiveLink}>
              Browse the archive →
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
