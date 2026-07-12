import { CSSProperties, useMemo, useState } from 'react';
import { Difficulty } from '../../game/rules';
import { TIER_ORDER, tierForRun } from '../../lib/stats';
import { difficultyColors } from '../../design/tokens';
import { usePlaysStore } from '../daily/sync/playsStore';
import { useStatsStore } from '../progress/statsStore';
import {
  Cell,
  DIFFICULTIES,
  MODE_LABEL,
  STATS_MODES,
  StatsMode,
  addCell,
  addTiers,
  avgOf,
  buildModeStats,
  emptyCell,
  emptyTiers,
} from './modeStats';
import { ScoreTrend } from './ScoreTrend';
import { StatsDesk } from './StatsDesk';
import { useTier } from '../../app/useTier';
import styles from './StatsPage.module.css';

// Tones for the BY MODE rows — distinct from the difficulty palette so
// the two tables read as different axes.
const MODE_TONE: Record<StatsMode, string> = {
  daily: '#6d4fa3',
  free: '#1f5d43',
};

type Filter =
  | { kind: 'mode'; mode: StatsMode }
  | { kind: 'difficulty'; difficulty: Difficulty }
  | null;

/**
 * All-time stats dashboard. Filtering is single-axis: tap a mode to
 * scope the whole page (including the difficulty table) to that mode, or
 * tap a difficulty to scope it (including the mode table) to that
 * difficulty. Tapping the active row clears the filter.
 */
export function StatsPage() {
  const stats = useStatsStore(s => s.stats);
  const plays = usePlaysStore(s => s.plays);
  const [filter, setFilter] = useState<Filter>(null);
  // Score distribution panel: tier bars vs the score-over-plays line.
  const [scoreView, setScoreView] = useState<'tiers' | 'trend'>('tiers');
  // Non-phone tiers (≥768px) render the desktop-redesign dashboard
  // INSTEAD of the phone panels (same JSX-fork pattern as HomePage) —
  // the phone panels are untouched below the tablet tier. Named
  // `layoutTier` to avoid shadowing the `tier` loop var below.
  const layoutTier = useTier();

  const data = useMemo(() => buildModeStats(stats, plays), [stats, plays]);

  // A mode row sums across difficulties, unless a difficulty is selected
  // (then it shows only that difficulty's games for the mode).
  const modeCell = (mode: StatsMode): Cell =>
    filter?.kind === 'difficulty'
      ? data.cells[mode][filter.difficulty]
      : DIFFICULTIES.reduce(
          (acc, d) => addCell(acc, data.cells[mode][d]),
          emptyCell()
        );

  // A difficulty row sums across modes, unless a mode is selected.
  const diffCell = (d: Difficulty): Cell =>
    filter?.kind === 'mode'
      ? data.cells[filter.mode][d]
      : STATS_MODES.reduce(
          (acc, m) => addCell(acc, data.cells[m][d]),
          emptyCell()
        );

  const scopedTiers = useMemo(() => {
    if (filter?.kind === 'mode') {
      return DIFFICULTIES.reduce(
        (acc, d) => addTiers(acc, data.tiers[filter.mode][d]),
        emptyTiers()
      );
    }
    if (filter?.kind === 'difficulty') {
      return STATS_MODES.reduce(
        (acc, m) => addTiers(acc, data.tiers[m][filter.difficulty]),
        emptyTiers()
      );
    }
    return STATS_MODES.reduce(
      (acc, m) =>
        DIFFICULTIES.reduce((a, d) => addTiers(a, data.tiers[m][d]), acc),
      emptyTiers()
    );
  }, [data, filter]);

  // After every hook so the hook count stays stable if the breakpoint
  // flips mid-session (window resize across 1024px).
  if (layoutTier !== 'phone') return <StatsDesk />;

  const scopedRuns = data.runs.filter(
    r =>
      (filter?.kind !== 'mode' || r.mode === filter.mode) &&
      (filter?.kind !== 'difficulty' || r.difficulty === filter.difficulty)
  );

  // Chronological score timeline, scoped by the same page filter.
  const scopedHistory = data.history.filter(
    p =>
      (filter?.kind !== 'mode' || p.mode === filter.mode) &&
      (filter?.kind !== 'difficulty' || p.difficulty === filter.difficulty)
  );

  const tierTotals = TIER_ORDER.map(tier => ({ tier, count: scopedTiers[tier] }));
  const tierMax = Math.max(1, ...tierTotals.map(t => t.count));
  const scopedGames = tierTotals.reduce((sum, t) => sum + t.count, 0);

  const filterNote =
    filter?.kind === 'mode'
      ? { label: MODE_LABEL[filter.mode], tone: MODE_TONE[filter.mode] }
      : filter?.kind === 'difficulty'
        ? { label: filter.difficulty, tone: difficultyColors[filter.difficulty] }
        : null;

  const cellTriple = (cell: Cell) => (
    <>
      <span>
        <span className={styles.cellLabel}>Best</span>
        {cell.best ?? '—'}
      </span>
      <span>
        <span className={styles.cellLabel}>Avg</span>
        {avgOf(cell) ?? '—'}
      </span>
      <span>
        <span className={styles.cellLabel}>Won</span>
        {cell.wins}/{cell.totalRuns}
      </span>
    </>
  );

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h1 className="text-title">Stats</h1>
        {filterNote && (
          <span
            className={styles.filterNote}
            style={{ '--difficulty-tone': filterNote.tone } as CSSProperties}
          >
            showing {filterNote.label} only
          </span>
        )}
      </header>

      <div className={styles.panel}>
        <h2 className="text-section">By mode</h2>
        <p className={styles.filterHint}>Tap a mode to filter the page.</p>
        {STATS_MODES.map(m => {
          const active = filter?.kind === 'mode' && filter.mode === m;
          return (
            <button
              key={m}
              type="button"
              className={`${styles.diffRow} ${active ? styles.diffRowActive : ''}`}
              style={{ '--difficulty-tone': MODE_TONE[m] } as CSSProperties}
              aria-pressed={active}
              onClick={() =>
                setFilter(active ? null : { kind: 'mode', mode: m })
              }
            >
              <span className={styles.diffName}>{MODE_LABEL[m]}</span>
              {cellTriple(modeCell(m))}
            </button>
          );
        })}
      </div>

      <div className={styles.panel}>
        <h2 className="text-section">By difficulty</h2>
        <p className={styles.filterHint}>Tap a difficulty to filter the page.</p>
        {DIFFICULTIES.map(d => {
          const active = filter?.kind === 'difficulty' && filter.difficulty === d;
          return (
            <button
              key={d}
              type="button"
              className={`${styles.diffRow} ${active ? styles.diffRowActive : ''}`}
              style={{ '--difficulty-tone': difficultyColors[d] } as CSSProperties}
              aria-pressed={active}
              onClick={() =>
                setFilter(active ? null : { kind: 'difficulty', difficulty: d })
              }
            >
              <span className={styles.diffName}>{d}</span>
              {cellTriple(diffCell(d))}
            </button>
          );
        })}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className="text-section">Score distribution</h2>
          <div
            className={styles.chartToggle}
            role="group"
            aria-label="Chart type"
          >
            <button
              type="button"
              className={styles.chartBtn}
              aria-label="Tier bars"
              aria-pressed={scoreView === 'tiers'}
              onClick={() => setScoreView('tiers')}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <rect x="1" y="8" width="3.4" height="7" rx="1" />
                <rect x="6.3" y="4" width="3.4" height="11" rx="1" />
                <rect x="11.6" y="1" width="3.4" height="14" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.chartBtn}
              aria-label="Score over plays"
              aria-pressed={scoreView === 'trend'}
              onClick={() => setScoreView('trend')}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <polyline
                  points="1,12 5.5,7 9,9.5 15,2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="5.5" cy="7" r="1.7" stroke="none" />
                <circle cx="9" cy="9.5" r="1.7" stroke="none" />
              </svg>
            </button>
          </div>
        </div>
        {scoreView === 'tiers' ? (
          scopedGames === 0 ? (
            <span className={styles.empty}>
              {filterNote
                ? `No ${filterNote.label} games recorded yet.`
                : 'Finish a game to see tiers.'}
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
          )
        ) : scopedHistory.length === 0 ? (
          <span className={styles.empty}>
            {filterNote
              ? `No ${filterNote.label} plays recorded yet.`
              : 'Finish a game to see your score timeline.'}
          </span>
        ) : (
          <ScoreTrend points={scopedHistory} />
        )}
      </div>

      <div className={styles.panel}>
        <h2 className="text-section">Recent runs</h2>
        {scopedRuns.length === 0 ? (
          <span className={styles.empty}>
            {filterNote
              ? `No recent ${filterNote.label} runs.`
              : 'No games recorded yet.'}
          </span>
        ) : (
          scopedRuns.slice(0, 20).map((run, i) => (
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
