import { ScoreReport } from '../../../game/scoring';
import { HAND_LABEL, lineLabel } from '../handLabels';
import styles from './LinesPanel.module.css';

export interface LinesPanelProps {
  report: ScoreReport;
  title?: string;
  /** Render rows only — no panel chrome (for nesting in accordions). */
  bare?: boolean;
}

/**
 * The live 10-line breakdown — a persistent surface (per the redesign
 * plan, what used to be a tap-to-open modal). Used in-game and on the
 * result view.
 */
export function LinesPanel({ report, title = 'Lines', bare = false }: LinesPanelProps) {
  return (
    <section
      className={bare ? undefined : styles.panel}
      aria-label="Line breakdown"
    >
      {!bare && <h2 className="text-section">{title}</h2>}
      {report.lines.map(line => (
        <div key={`${line.kind}-${line.index}`} className={styles.line}>
          <span className={styles.label}>{lineLabel(line.kind, line.index)}</span>
          {line.hand ? (
            <span className={styles.hand}>
              {HAND_LABEL[line.hand]}
              {line.multiplier !== 1 && (
                <span className={styles.mult}>×{trimMult(line.multiplier)}</span>
              )}
            </span>
          ) : (
            <span className={`${styles.hand} ${styles.empty}`}>
              {/* An open line reads "Open" during play; once the game ends
                  its penalty lands (negative total) — it's Incomplete. */}
              {line.incomplete ? (line.total < 0 ? 'Incomplete' : 'Open') : '—'}
            </span>
          )}
          <span className={styles.pts}>{line.total}</span>
        </div>
      ))}
      <div className={styles.totalRow}>
        <span>Subtotal</span>
        <span>{report.subtotal}</span>
      </div>
    </section>
  );
}

const trimMult = (m: number): string =>
  Number.isInteger(m) ? String(m) : m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
