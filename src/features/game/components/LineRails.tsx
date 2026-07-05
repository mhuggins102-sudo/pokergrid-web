import { ReactNode } from 'react';
import { Grid } from '../../../game/grid';
import { ScoreReport, ScoredLine } from '../../../game/scoring';
import { HAND_LABEL, lineLabel } from '../handLabels';
import { GridBoard } from './GridBoard';
import styles from './LineRails.module.css';

export interface LineRailsProps {
  grid: Grid;
  report: ScoreReport;
  /** Tapping a total opens that line's calculation. */
  onLineTap?: (line: ScoredLine) => void;
  /**
   * Result-screen tally: chips pop in staggered (rows R1–R5, then
   * columns C1–C5) so the score visibly assembles line by line.
   * Reduced motion collapses it to instant via the global reset.
   */
  stagger?: boolean;
  /**
   * Custom board to wrap (the live GameScreen board with its targeting
   * props). Defaults to a plain read-only GridBoard of `grid`.
   */
  children?: ReactNode;
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
 * screen (with the tally stagger).
 */
export function LineRails({
  grid,
  report,
  onLineTap,
  stagger = false,
  children,
}: LineRailsProps) {
  const rows = report.lines.filter(l => l.kind === 'row');
  const cols = report.lines.filter(l => l.kind === 'col');

  const chip = (line: ScoredLine, tallyIndex: number) => (
    <button
      key={`${line.kind}-${line.index}`}
      type="button"
      className={`${styles.chip} ${
        line.kind === 'row' ? styles.rowChip : ''
      } ${toneOf(line)} ${stagger ? styles.tallyIn : ''}`}
      style={stagger ? { animationDelay: `${tallyIndex * 110}ms` } : undefined}
      onClick={() => onLineTap?.(line)}
      aria-label={chipLabel(line)}
    >
      {chipText(line)}
    </button>
  );

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
