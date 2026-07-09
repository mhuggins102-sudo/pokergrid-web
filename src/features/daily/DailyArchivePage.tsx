import { ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { currentDateISO } from '../../game/daily/seed';
import { dailyTargetFor, recipeFor } from '../../game/daily/recipe';
import { findChallenge } from '../../game/challenges';
import { tierForRun } from '../../lib/stats';
import { isBackendConfigured } from '../../lib/supabaseRpc';
import { DAILY_LAUNCH_ISO, datesBack, formatDailyDate } from './dailyDates';
import { DailyPlay, usePlaysStore } from './sync/playsStore';
import { useArchiveRank } from './sync/useDailyRank';
import { DayStatsSheet } from './RankPanel';
import styles from './DailyArchivePage.module.css';

/**
 * Right-hand cell of a played row: score · tier on top, the player's
 * leaderboard standing (#x / y) beneath once it's known. Own component
 * so each row can hold its rank query.
 */
function PlayedCell({
  date,
  play,
  target,
}: {
  date: string;
  play: DailyPlay;
  target: number;
}) {
  const rank = useArchiveRank(date);
  return (
    <span className={styles.rightCol}>
      <span
        className={`${styles.score} ${play.won ? styles.won : styles.lost}`}
      >
        {play.score} ·{' '}
        {tierForRun({ score: play.score, target, won: play.won })}
      </span>
      {rank.data && (
        <span className={styles.rank}>
          #{rank.data.rank} / {rank.data.total}
        </span>
      )}
    </span>
  );
}

/** /daily/archive — every published daily, play or revisit. */
export function DailyArchivePage() {
  const plays = usePlaysStore(s => s.plays);
  const today = currentDateISO();
  const dates = datesBack(today, DAILY_LAUNCH_ISO);
  // Played rows split their tap zones: the date side opens the full
  // result, the score/rank side opens the leaderboard popup right
  // here. `date` persists after close so the sheet animates out with
  // its content intact.
  const backend = isBackendConfigured();
  const [sheet, setSheet] = useState<{ date: string; open: boolean }>({
    date: DAILY_LAUNCH_ISO,
    open: false,
  });

  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Daily archive</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          Every daily since launch. Played dates open their result; missed
          dates are still playable.
        </p>
      </header>
      <div className={styles.list}>
        {dates.map(date => {
          const play = plays[date];
          const recipe = recipeFor(date);
          const twist = recipe.twist ? findChallenge(recipe.twist) : null;
          const target = dailyTargetFor(recipe.difficulty, recipe.twist);
          const dateCol: ReactNode = (
            <span className={styles.dateCol}>
              <span className={styles.dateLine}>
                <span className={styles.date}>{formatDailyDate(date)}</span>
                {date === today && <span className={styles.today}>Today</span>}
              </span>
              <span className={styles.recipe}>
                {recipe.difficulty} · target {target}
                {twist && <span className={styles.twist}> · {twist.name}</span>}
              </span>
            </span>
          );
          // Played + leaderboard available: split the row — the link
          // keeps the left side, the score cell becomes a button that
          // opens the day's leaderboard in place.
          if (play && backend) {
            return (
              <div key={date} className={`${styles.row} ${styles.rowSplit}`}>
                <Link to={`/daily/${date}`} className={styles.rowLink}>
                  {dateCol}
                </Link>
                <button
                  type="button"
                  className={styles.rowStats}
                  aria-label={`Leaderboard — ${formatDailyDate(date)}`}
                  onClick={() => setSheet({ date, open: true })}
                >
                  <PlayedCell date={date} play={play} target={target} />
                </button>
              </div>
            );
          }
          return (
            <Link key={date} to={`/daily/${date}`} className={styles.row}>
              {dateCol}
              {play ? (
                <PlayedCell date={date} play={play} target={target} />
              ) : (
                <span className={styles.state}>Play</span>
              )}
            </Link>
          );
        })}
      </div>

      <DayStatsSheet
        dateISO={sheet.date}
        open={sheet.open}
        onClose={() => setSheet(s => ({ ...s, open: false }))}
      />
    </section>
  );
}
