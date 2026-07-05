import { ReactNode } from 'react';
import { Grid } from '../../../game/grid';
import { ScoreReport, ScoredLine } from '../../../game/scoring';
import { HAND_LABEL, lineLabel } from '../handLabels';
import { GridBoard } from './GridBoard';
import styles from './LineRails.module.css';

// Result-screen tally: which values the chips show and how boosted
// lines dress. 'base' shows each line's no-bonus-cards total; 'boosted'
// shows the final totals with gold styling on every line the gold
// cards changed. The stage flip re-pops the changed chips.
export interface RailTally {
  /** Per-line base totals keyed by `${kind}${index}` (no-bonus report). */
  baseTotals: ReadonlyMap<string, number>;
  stage: 'base' | 'boosted';
  /** Animate the base→boosted flip (re-pop). Off = static end state. */
  animate?: boolean;
}

export interface LineRailsProps {
  grid: Grid;
  report: ScoreReport;
  /** Tapping a total opens that line's calculation. */
  onLineTap?: (line: ScoredLine) => void;
  /**
   * Result-screen entrance: chips pop in staggered (rows R1–R5, then
   * columns C1–C5) so the score visibly assembles line by line.
   * Reduced motion collapses it to instant via the global reset.
   */
  stagger?: boolean;
  /** Base/boosted tally staging (see RailTally). Omit = live behavior. */
  tally?: RailTally;
  /**
   * Custom board to wrap (the live GameScreen board with its targeting
   * props). Defaults to a plain read-only GridBoard of `grid`.
   */
  children?: ReactNode;
  /**
   * Spotlight: light up the chips for this row + column (the in-place
   * replacement for the floating line tags while rails are showing).
   */
  highlight?: { row: number; col: number } | null;
}

const toneOf = (line: ScoredLine): string =>
  line.total > 0 ? styles.pos : line.total < 0 ? styles.neg : styles.zero;

const chipLabel = (line: ScoredLine): string => {
  const hand = line.hand ? HAND_LABEL[line.hand] : 'no hand';
  return `${lineLabel(line.kind, line.index)}: ${hand}, ${line.total} points`;
};

// Live in-game boards score incomplete lines as 0 (the -25 penalty only
// exists at game end) — show a quiet dot instead of a misleading "0".
// Completed 0-point lines (High Card) still show the number.
const chipText = (line: ScoredLine): string =>
  line.incomplete && line.total === 0 ? '·' : String(line.total);

/**
 * A board with its ten line totals attached as rails — row totals down
 * the edge, column totals underneath. Board and scores read as one
 * visual instead of a board plus a separate table. Used live on the
 * game screen (wrapping the interactive board) and on the result
 * screen (with the entrance stagger + base/boosted tally).
 */
export function LineRails({
  grid,
  report,
  onLineTap,
  stagger = false,
  tally,
  children,
  highlight = null,
}: LineRailsProps) {
  const rows = report.lines.filter(l => l.kind === 'row');
  const cols = report.lines.filter(l => l.kind === 'col');

  const isLit = (line: ScoredLine): boolean =>
    highlight !== null &&
    (line.kind === 'row'
      ? line.index === highlight.row
      : line.index === highlight.col);

  const chip = (line: ScoredLine, tallyIndex: number) => {
    const key = `${line.kind}${line.index}`;
    const baseTotal = tally?.baseTotals.get(key) ?? line.total;
    const boosted = tally !== undefined && baseTotal !== line.total;
    const showBase = tally?.stage === 'base';
    const text = showBase ? String(baseTotal) : chipText(line);
    // Gold dressing (and its re-pop) belongs to the boosted stage.
    const goldNow = boosted && tally?.stage === 'boosted';
    return (
      <button
        key={`${line.kind}-${line.index}`}
        type="button"
        className={`${styles.chip} ${
          line.kind === 'row' ? styles.rowChip : ''
        } ${toneOf(line)} ${stagger ? styles.tallyIn : ''} ${
          goldNow ? styles.chipGold : ''
        } ${goldNow && tally?.animate ? styles.chipGoldIn : ''} ${
          isLit(line) ? styles.chipLit : ''
        }`}
        style={
          // The gold re-pop supersedes the entrance stagger — the
          // entrance has finished by the time the stage flips, and the
          // flip swaps the animation property wholesale.
          goldNow && tally?.animate
            ? { animationDelay: `${tallyIndex * 160}ms` }
            : stagger
              ? { animationDelay: `${tallyIndex * 220}ms` }
              : undefined
        }
        onClick={() => onLineTap?.(line)}
        aria-label={chipLabel(line)}
        aria-current={isLit(line) || undefined}
      >
        {text}
      </button>
    );
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.board}>
        {children ?? <GridBoard grid={grid} />}
      </div>
      <div className={styles.rowRail} aria-label="Row totals">
        {rows.map((l, i) => chip(l, i))}
      </div>
      <div className={styles.colRail} aria-label="Column totals">
        {cols.map((l, i) => chip(l, 5 + i))}
      </div>
      <div className={styles.corner} aria-hidden="true" />
    </div>
  );
}
