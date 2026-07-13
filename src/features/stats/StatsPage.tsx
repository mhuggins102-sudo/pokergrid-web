import { CSSProperties, useMemo, useState } from 'react';
import { CHALLENGES } from '../../game/challenges';
import { Difficulty, TARGET_BY_DIFFICULTY } from '../../game/rules';
import { TIER_ORDER, Tier, tierForRun } from '../../lib/stats';
import { difficultyColors } from '../../design/tokens';
import { useTier } from '../../app/useTier';
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
import styles from './StatsPage.module.css';

/*
 * The stats dashboard, per design-refs/desktop/Stats.dc.html:
 * two filter rows (mode, difficulty — each row filters one axis;
 * nothing selected on a row means "all", clicking the active tab clears
 * it), four headline stat cards, the rating breakdown bars, a
 * recent-scores scatter with the difficulty's target line, and the
 * recent-runs table with ✦ twist pills on twisted dailies. All values
 * bind to the buildModeStats roll-up. One responsive tree at every
 * tier (phase 4 convergence); the phone block in the stylesheet
 * stacks the panels.
 */

const DIFF_NAME: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  extreme: 'Extreme',
};

// Tier tone ramp from the mockup — SS accent through D danger.
const TIER_COLOR: Record<Tier, string> = {
  SS: 'var(--accent)',
  S: 'var(--success)',
  A: 'var(--warn)',
  B: 'var(--ink-2)',
  C: 'var(--ink-3)',
  D: 'var(--danger)',
};

const SCATTER_N = 14;

const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const twistName = (id: string): string =>
  CHALLENGES.find(c => c.id === id)?.name ?? id;

export function StatsPage() {
  const stats = useStatsStore(s => s.stats);
  const plays = usePlaysStore(s => s.plays);
  // Independent single-select per row; 'all' = row unselected.
  const [mode, setMode] = useState<StatsMode | 'all'>('all');
  const [diff, setDiff] = useState<Difficulty | 'all'>('all');
  const isPhone = useTier() === 'phone';
  // Phone: the rating-breakdown panel hosts the recent-scores scatter and
  // the recent-runs list behind two header icons (both off = the tier
  // breakdown). ≥768 keeps the three panels laid out side by side.
  const [statsView, setStatsView] = useState<'scatter' | 'runs' | null>(null);

  const data = useMemo(() => buildModeStats(stats, plays), [stats, plays]);

  const modes = mode === 'all' ? STATS_MODES : [mode];
  const diffs = diff === 'all' ? DIFFICULTIES : [diff];

  // Both axes apply together (the mockup's two filter rows compose).
  const scopedCell: Cell = modes.reduce(
    (acc, m) => diffs.reduce((a, d) => addCell(a, data.cells[m][d]), acc),
    emptyCell()
  );
  const scopedTiers = modes.reduce(
    (acc, m) => diffs.reduce((a, d) => addTiers(a, data.tiers[m][d]), acc),
    emptyTiers()
  );
  const scopedRuns = data.runs.filter(
    r => modes.includes(r.mode) && diffs.includes(r.difficulty)
  );
  const scopedHistory = data.history.filter(
    p => modes.includes(p.mode) && diffs.includes(p.difficulty)
  );

  const winPct =
    scopedCell.totalRuns > 0
      ? `${Math.round((scopedCell.wins / scopedCell.totalRuns) * 100)}%`
      : '—';
  // Phone shortens two labels ("Best" / "Played") so the four tiles shrink
  // to squares; ≥768 keeps the full labels.
  const headline = [
    {
      value: scopedCell.best ?? '—',
      label: isPhone ? 'Best' : 'Best score',
      color: 'var(--accent)',
    },
    { value: avgOf(scopedCell) ?? '—', label: 'Avg score', color: 'var(--ink)' },
    { value: winPct, label: 'Win rate', color: 'var(--ink)' },
    {
      value: scopedCell.totalRuns,
      label: isPhone ? 'Played' : 'Games played',
      color: 'var(--ink)',
    },
  ];

  const tierMax = Math.max(1, ...TIER_ORDER.map(t => scopedTiers[t]));
  const selName = diff === 'all' ? 'All levels' : DIFF_NAME[diff];

  // Scatter — the last N plays, oldest → newest. The target line only
  // draws when one difficulty is scoped (each difficulty has its own).
  const points = scopedHistory.slice(-SCATTER_N);
  const target = diff === 'all' ? null : TARGET_BY_DIFFICULTY[diff];
  const scores = points.map(p => p.score);
  const lo =
    Math.min(...(scores.length ? scores : [0]), ...(target ? [target] : [])) *
    0.9;
  const hi =
    Math.max(...(scores.length ? scores : [1]), ...(target ? [target] : [])) *
    1.05;
  const yFor = (v: number) => 100 - ((v - lo) / Math.max(1, hi - lo)) * 100;

  const tab = (
    label: string,
    tone: string,
    active: boolean,
    onClick: () => void
  ) => (
    <button
      key={label}
      type="button"
      className={`${styles.tab} ${active ? styles.tabOn : ''}`}
      style={{ '--tab-tone': tone } as CSSProperties}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );

  // The three panel bodies, extracted so the phone single-panel view and
  // the desktop three-panel layout render the exact same content.
  const tierBreakdown = (
    <div className={styles.tierList}>
      {TIER_ORDER.map(t => (
        <div key={t} className={styles.tierRow}>
          <span className={styles.tierKey} style={{ color: TIER_COLOR[t] }}>
            {t}
          </span>
          <div className={styles.tierTrack}>
            <div
              className={styles.tierFill}
              style={{
                width: `${Math.round((scopedTiers[t] / tierMax) * 100)}%`,
                background: TIER_COLOR[t],
              }}
            />
          </div>
          <span className={styles.tierCount}>{scopedTiers[t]}</span>
        </div>
      ))}
    </div>
  );

  const scatterBody = (
    <>
      <div className={styles.scatterPlot}>
        {target !== null && points.length > 0 && (
          <>
            <div
              className={styles.targetLine}
              style={{ top: `${yFor(target)}%` }}
            />
            <span
              className={styles.targetLabel}
              style={{ top: `${yFor(target)}%` }}
            >
              TARGET {target}
            </span>
          </>
        )}
        {points.length === 0 ? (
          <span className={styles.empty}>No games recorded yet.</span>
        ) : (
          points.map((p, i) => (
            <div
              key={`${p.ts}-${i}`}
              className={`${styles.dot} ${p.won ? styles.dotWon : ''}`}
              style={{
                left: `${
                  points.length === 1 ? 50 : (i / (points.length - 1)) * 96 + 2
                }%`,
                top: `${yFor(p.score)}%`,
              }}
              title={`${p.score} · ${p.difficulty} · ${p.won ? 'won' : 'lost'}`}
            />
          ))
        )}
      </div>
      <div className={styles.scatterAxis}>
        <span>Older</span>
        <span>Recent</span>
      </div>
    </>
  );

  const runsBody = (
    <>
      <div className={`${styles.runGrid} ${styles.runHead}`}>
        <span>Date</span>
        <span />
        <span className={styles.runCenter}>Score</span>
        <span className={styles.runCenter}>Target</span>
        <span className={styles.runCenter}>Rating</span>
      </div>
      {scopedRuns.length === 0 ? (
        <span className={styles.empty}>No games recorded yet.</span>
      ) : (
        scopedRuns.slice(0, 6).map((run, i) => {
          const rt = tierForRun(run);
          return (
            <div key={`${run.ts}-${i}`} className={styles.runGrid}>
              <span className={styles.runDate}>{fmtDate(run.ts)}</span>
              <span className={styles.runTwistCell}>
                {run.twist && (
                  <span className={styles.twistPill}>
                    <span aria-hidden="true">✦</span> {twistName(run.twist)}
                  </span>
                )}
              </span>
              <span className={styles.runScore}>{run.score}</span>
              <span className={styles.runTarget}>{run.target}</span>
              <span
                className={styles.runBadge}
                style={{ '--tier-tone': TIER_COLOR[rt] } as CSSProperties}
              >
                {rt}
              </span>
            </div>
          );
        })
      )}
    </>
  );

  // Phone: the two header icons that swap the panel body.
  const statsToggle = (
    <div className={styles.chartToggle} role="group" aria-label="Panel view">
      <button
        type="button"
        className={`${styles.chartBtn} ${
          statsView === 'scatter' ? styles.chartBtnOn : ''
        }`}
        aria-label="Recent scores"
        aria-pressed={statsView === 'scatter'}
        onClick={() => setStatsView(v => (v === 'scatter' ? null : 'scatter'))}
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 17 9 11 13 15 21 6" />
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.chartBtn} ${
          statsView === 'runs' ? styles.chartBtnOn : ''
        }`}
        aria-label="Recent runs"
        aria-pressed={statsView === 'runs'}
        onClick={() => setStatsView(v => (v === 'runs' ? null : 'runs'))}
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Stats</div>
      {/* One line: the heading with both filter groups beside it —
          modes in one container, difficulties in a second to its
          right. Same single-select-per-axis semantics as before. */}
      <div className={styles.headRow}>
        <h1 className={styles.title}>Your record</h1>
        <div className={styles.filters}>
          <div
            className={styles.filtGroup}
            role="group"
            aria-label="Mode filter"
          >
            {STATS_MODES.map(m =>
              tab(MODE_LABEL[m], 'var(--accent)', mode === m, () =>
                setMode(cur => (cur === m ? 'all' : m))
              )
            )}
          </div>
          <div
            className={styles.filtGroup}
            role="group"
            aria-label="Difficulty filter"
          >
            {DIFFICULTIES.map(d =>
              tab(DIFF_NAME[d], difficultyColors[d], diff === d, () =>
                setDiff(cur => (cur === d ? 'all' : d))
              )
            )}
          </div>
        </div>
      </div>

      <div className={styles.headline}>
        {headline.map(h => (
          <div key={h.label} className={styles.headCard}>
            <div className={styles.headValue} style={{ color: h.color }}>
              {h.value}
            </div>
            <div className={styles.headLabel}>{h.label}</div>
          </div>
        ))}
      </div>

      {isPhone ? (
        /* Phone: ONE panel. The tier breakdown is the default; the two
           header icons swap in the recent-scores scatter or the
           recent-runs list (the separate panels are gone here). */
        <div className={styles.chartRow}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>
                {statsView === 'scatter'
                  ? 'Recent scores'
                  : statsView === 'runs'
                    ? 'Recent runs'
                    : 'Rating breakdown'}
              </h2>
              {statsToggle}
            </div>
            {statsView === 'scatter' ? (
              <>
                <p className={styles.panelSub}>
                  last {points.length} game{points.length === 1 ? '' : 's'}
                </p>
                {scatterBody}
              </>
            ) : statsView === 'runs' ? (
              runsBody
            ) : (
              <>
                <p className={styles.panelSub}>
                  How your {selName} finishes graded out.
                </p>
                {tierBreakdown}
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.chartRow}>
            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>Rating breakdown</h2>
              <p className={styles.panelSub}>
                How your {selName} finishes graded out.
              </p>
              {tierBreakdown}
            </div>

            <div className={styles.panel}>
              <div className={styles.scatterHead}>
                <h2 className={styles.panelTitle}>Recent scores</h2>
                <span className={styles.scatterNote}>
                  last {points.length} game{points.length === 1 ? '' : 's'}
                </span>
              </div>
              {scatterBody}
            </div>
          </div>

          <div className={styles.runsRow}>
            <div className={styles.panel}>
              <h2 className={`${styles.panelTitle} ${styles.runsTitle}`}>
                Recent runs
              </h2>
              {runsBody}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
