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
}

const toneOf = (line: ScoredLine): string =>
  line.total > 0 ? styles.pos : line.total < 0 ? styles.neg : styles.zero;

const chipLabel = (line: ScoredLine): string => {
  const hand = line.hand ? HAND_LABEL[line.hand] : 'no hand';
  return `${lineLabel(line.kind, line.index)}: ${hand}, ${line.total} points`;
};

/**
 * The final board with its ten line totals attached as rails — row
 * totals down the right edge, column totals underneath. Board and
 * scores read as one visual instead of a board plus a separate table.
 */
export function LineRails({ grid, report, onLineTap }: LineRailsProps) {
  const rows = report.lines.filter(l => l.kind === 'row');
  const cols = report.lines.filter(l => l.kind === 'col');

  const chip = (line: ScoredLine) => (
    <button
      key={`${line.kind}-${line.index}`}
      type="button"
      className={`${styles.chip} ${toneOf(line)}`}
      onClick={() => onLineTap?.(line)}
      aria-label={chipLabel(line)}
    >
      {line.total}
    </button>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.board}>
        <GridBoard grid={grid} />
      </div>
      <div className={styles.rowRail} aria-label="Row totals">
        {rows.map(chip)}
      </div>
      <div className={styles.colRail} aria-label="Column totals">
        {cols.map(chip)}
      </div>
      <div className={styles.corner} aria-hidden="true" />
    </div>
  );
}
