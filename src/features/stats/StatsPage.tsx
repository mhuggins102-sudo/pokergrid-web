import { CSSProperties } from 'react';
import { Difficulty } from '../../game/rules';
import { TIER_ORDER, tierForRun } from '../../lib/stats';
import { difficultyColors } from '../../design/tokens';
import { useStatsStore } from '../progress/statsStore';
import styles from './StatsPage.module.css';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];

/** All-time stats dashboard (free play). */
export function StatsPage() {
  const stats = useStatsStore(s => s.stats);
  const totalRuns = stats.wins + stats.losses;

  const tierTotals = TIER_ORDER.map(tier => ({
    tier,
    count: DIFFICULTIES.reduce((sum, d) => sum + stats.tierCounts[d][tier], 0),
  }));
  const tierMax = Math.max(1, ...tierTotals.map(t => t.count));

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h1 className="text-title">Stats</h1>
      </header>

      <div className={styles.summaryRow}>
        <div className={styles.summaryChip}>
          <span className={styles.summaryValue}>{totalRuns}</span>
          <span className={styles.summaryLabel}>Games</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.summaryValue}>{stats.wins}</span>
          <span className={styles.summaryLabel}>Wins</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.summaryValue}>{stats.streak}</span>
          <span className={styles.summaryLabel}>Streak</span>
        </div>
        <div className={styles.summaryChip}>
          <span className={styles.summaryValue}>{stats.longestStreak}</span>
          <span className={styles.summaryLabel}>Best streak</span>
        </div>
      </div>

      <div className={styles.panel}>
        <h2 className="text-section">By difficulty</h2>
        {DIFFICULTIES.map(d => {
          const s = stats.byDifficulty[d];
          const avg = s.totalRuns > 0 ? Math.round(s.totalScore / s.totalRuns) : null;
          return (
            <div
              key={d}
              className={styles.diffRow}
              style={{ '--difficulty-tone': difficultyColors[d] } as CSSProperties}
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
            </div>
          );
        })}
      </div>

      <div className={styles.panel}>
        <h2 className="text-section">Score distribution</h2>
        {totalRuns === 0 ? (
          <span className={styles.empty}>Finish a free-play game to see tiers.</span>
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
        {stats.recent.length === 0 ? (
          <span className={styles.empty}>No games recorded yet.</span>
        ) : (
          stats.recent.map((run, i) => (
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
