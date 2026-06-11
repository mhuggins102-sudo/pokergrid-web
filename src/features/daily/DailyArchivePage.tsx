import { Link } from 'react-router';
import { currentDateISO } from '../../game/daily/seed';
import { dailyTargetFor, recipeFor } from '../../game/daily/recipe';
import { findChallenge } from '../../game/challenges';
import { tierForRun } from '../../lib/stats';
import { usePlaysStore } from './sync/playsStore';
import styles from './DailyArchivePage.module.css';

const ARCHIVE_DAYS = 14;

const datesBack = (todayISO: string, days: number): string[] => {
  const [y, m, d] = todayISO.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  return Array.from({ length: days }, (_, i) => {
    const dt = new Date(base - i * 86_400_000);
    return dt.toISOString().slice(0, 10);
  });
};

/** /daily/archive — the last two weeks of puzzles, play or revisit. */
export function DailyArchivePage() {
  const plays = usePlaysStore(s => s.plays);
  const today = currentDateISO();
  const dates = datesBack(today, ARCHIVE_DAYS);

  return (
    <section className={styles.wrap}>
      <header>
        <h1 className="text-title">Daily archive</h1>
        <p className="text-body" style={{ color: 'var(--ink-2)' }}>
          The last {ARCHIVE_DAYS} days. Played dates open their result;
          missed dates are still playable.
        </p>
      </header>
      <div className={styles.list}>
        {dates.map(date => {
          const play = plays[date];
          const recipe = recipeFor(date);
          const twist = recipe.twist ? findChallenge(recipe.twist) : null;
          const target = dailyTargetFor(recipe.difficulty, recipe.twist);
          return (
            <Link key={date} to={`/daily/${date}`} className={styles.row}>
              <span className={styles.dateCol}>
                <span className={styles.date}>{date}</span>
                <span className={styles.recipe}>
                  {recipe.difficulty} · target {target}
                  {twist && <span className={styles.twist}> · {twist.name}</span>}
                </span>
              </span>
              {date === today && <span className={styles.today}>Today</span>}
              {play ? (
                <span
                  className={`${styles.score} ${play.won ? styles.won : styles.lost}`}
                >
                  {play.score} ·{' '}
                  {tierForRun({ score: play.score, target, won: play.won })}
                </span>
              ) : (
                <span className={styles.state}>Play</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
