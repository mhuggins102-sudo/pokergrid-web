import { CSSProperties, useState } from 'react';
import { Difficulty } from '../../game/rules';
import { TIER_ORDER, tierForRun } from '../../lib/stats';
import { difficultyColors } from '../../design/tokens';
import { useStatsStore } from '../progress/statsStore';
import styles from './StatsPage.module.css';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

/**
 * All-time stats dashboard (free play). Tapping a difficulty row
 * filters the summary chips, tier histogram, and recent runs to that
 * difficulty; tapping it again (or another row) clears or moves the
 * filter.
 */
export function StatsPage() {
  const stats = useStatsStore(s => s.stats);
  const [filter, setFilter] = useState<Difficulty | null>(null);

  const summary = filter
    ? {
        games: stats.byDifficulty[filter].totalRuns,
        wins: stats.byDifficulty[filter].wins,
        streak: stats.byDifficulty[filter].currentStreak,
        bestStreak: stats.byDifficulty[filter].bestStreak,
      }
    : {
        games: stats.wins + stats.losses,
        wins: stats.wins,
        streak: stats.streak,
        bestStreak: stats.longestStreak,
      };

  const tierTotals = TIER_ORDER.map(tier => ({
    tier,
    count: filter
      ? stats.tierCounts[filter][tier]
      : DIFFICULTIES.reduce((sum, d) => sum + stats.tierCounts[d][tier], 0),
  }));
  const tierMax = Math.max(1, ...tierTotals.map(t => t.count));

  const recent = filter
    ? stats.recent.filter(r => r.difficulty === filter)
    : stats.recent;

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h1 className="text-title">Stats</h1>
        {filter && (
          <span
            className={styles.filterNote}
            style={{ '--difficulty-tone': difficultyColors[filter] } as CSSProperties}
          >
            showing {filter} only
          </span>
        )}
      </header>

      <div className={styles.summaryRow}>
        <div className={styles.summaryChip}>
          <span className={styles.summaryValue}>{summary.games}</span>
          <span className={styles.summaryLabel}>Games</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.summaryValue}>{summary.wins}</span>
          <span className={styles.summaryLabel}>Wins</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.summaryValue}>{summary.streak}</span>
          <span className={styles.summaryLabel}>Streak</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.summaryValue}>{summary.bestStreak}</span>
          <span className={styles.summaryLabel}>Best streak</span>
        </div>
      </div>

      <div className={styles.panel}>
        <h2 className="text-section">By difficulty</h2>
        <p className={styles.filterHint}>Tap a difficulty to filter the page.</p>
        {DIFFICULTIES.map(d => {
          const s = stats.byDifficulty[d];
          const avg = s.totalRuns > 0 ? Math.round(s.totalScore / s.totalRuns) : null;
          const active = filter === d;
          return (
            <button
              key={d}
              type="button"
              className={`${styles.diffRow} ${active ? styles.diffRowActive : ''}`}
              style={{ '--difficulty-tone': difficultyColors[d] } as CSSProperties}
              aria-pressed={active}
              onClick={() => setFilter(active ? null : d)}
            >
              <span className={styles.diffName}>{d}</span>
              <span>
                <span className={styles.cellLabel}>Best</span>
                {s.best ?? '—'}
              </span>
              <span>
                <span className={styles.cellLabel}>Avg</span>
                {avg ?? '—'}
              </span>
              <span>
                <span className={styles.cellLabel}>Won</span>
                {s.wins}/{s.totalRuns}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.panel}>
        <h2 className="text-section">Score distribution</h2>
        {summary.games === 0 ? (
          <span className={styles.empty}>
            {filter
              ? `No ${filter} games recorded yet.`
              : 'Finish a free-play game to see tiers.'}
          </span>
        ) : (
          <div className={styles.tierBars}>
            {tierTotals.map(({ tier, count }) => (
              <div key={tier} className={styles.tierBarRow}>
                <span className={styles.tierName}>{tier}</span>
                <div className={styles.tierTrack}>
                  <div
                    className={styles.tierFill}
                    style={{ width: `${(count / tierMax) * 100}%` }}
                  />
                </div>
                <span>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.panel}>
        <h2 className="text-section">Recent runs</h2>
        {recent.length === 0 ? (
          <span className={styles.empty}>
            {filter
              ? `No recent ${filter} runs.`
              : 'No games recorded yet.'}
          </span>
        ) : (
          recent.map((run, i) => (
            <div key={`${run.ts}-${i}`} className={styles.recentRow}>
              <span className={styles.recentTier}>{tierForRun(run)}</span>
              <span className={styles.recentDiff}>{run.difficulty}</span>
              <span>
                {run.score} / {run.target}
              </span>
              <span className={run.won ? styles.recentWon : styles.recentLost}>
                {run.won ? 'won' : 'lost'}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
