import { CSSProperties, useMemo, useState } from 'react';
import { CHALLENGES } from '../../game/challenges';
import { Difficulty, TARGET_BY_DIFFICULTY } from '../../game/rules';
import { TIER_ORDER, Tier, tierForRun } from '../../lib/stats';
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
  const headline = [
    {
      value: scopedCell.best ?? '—',
      label: 'Best score',
      color: 'var(--accent)',
    },
    { value: avgOf(scopedCell) ?? '—', label: 'Avg score', color: 'var(--ink)' },
    { value: winPct, label: 'Win rate', color: 'var(--ink)' },
    {
      value: scopedCell.totalRuns,
      label: 'Games played',
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

      <div className={styles.chartRow}>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Rating breakdown</h2>
          <p className={styles.panelSub}>
            How your {selName} finishes graded out.
          </p>
          <div className={styles.tierList}>
            {TIER_ORDER.map(t => (
              <div key={t} className={styles.tierRow}>
                <span
                  className={styles.tierKey}
                  style={{ color: TIER_COLOR[t] }}
                >
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
        </div>

        <div className={styles.panel}>
          <div className={styles.scatterHead}>
            <h2 className={styles.panelTitle}>Recent scores</h2>
            <span className={styles.scatterNote}>
              last {points.length} game{points.length === 1 ? '' : 's'}
            </span>
          </div>
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
                      points.length === 1
                        ? 50
                        : (i / (points.length - 1)) * 96 + 2
                    }%`,
                    top: `${yFor(p.score)}%`,
                  }}
                  title={`${p.score} · ${p.difficulty} · ${
                    p.won ? 'won' : 'lost'
                  }`}
                />
              ))
            )}
          </div>
          <div className={styles.scatterAxis}>
            <span>Older</span>
            <span>Recent</span>
          </div>
        </div>
      </div>

      <div className={styles.runsRow}>
        <div className={styles.panel}>
          <h2 className={`${styles.panelTitle} ${styles.runsTitle}`}>
            Recent runs
          </h2>
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
                  <span>
                    {run.twist && (
                      <span className={styles.twistPill}>
                        <span aria-hidden="true">✦</span>{' '}
                        {twistName(run.twist)}
                      </span>
                    )}
                  </span>
                  <span className={styles.runScore}>{run.score}</span>
                  <span className={styles.runTarget}>{run.target}</span>
                  <span
                    className={styles.runBadge}
                    style={
                      {
                        '--tier-tone': TIER_COLOR[rt],
                      } as CSSProperties
                    }
                  >
                    {rt}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
