import { Link } from 'react-router';
import { currentDateISO } from '../../game/daily/seed';
import { dailyTargetFor, recipeFor } from '../../game/daily/recipe';
import { findChallenge } from '../../game/challenges';
import { tierForRun } from '../../lib/stats';
import { usePlaysStore } from './sync/playsStore';
import styles from './DailyArchivePage.module.css';

// The first daily ever published (carried over from the original site)
// — the archive runs all the way back to it.
const DAILY_LAUNCH_ISO = '2026-05-01';

const datesBack = (todayISO: string, earliestISO: string): string[] => {
  const [y, m, d] = todayISO.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out: string[] = [];
  for (let i = 0; ; i++) {
    const iso = new Date(base - i * 86_400_000).toISOString().slice(0, 10);
    if (iso < earliestISO) break;
    out.push(iso);
  }
  return out;
};

/** /daily/archive — every published daily, play or revisit. */
export function DailyArchivePage() {
  const plays = usePlaysStore(s => s.plays);
  const today = currentDateISO();
  const dates = datesBack(today, DAILY_LAUNCH_ISO);

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
