import { BonusCard } from '../../../game/bonusCards';
import {
  INCOMPLETE_LINE_PENALTY,
  ScoreReport,
  ScoredLine,
} from '../../../game/scoring';
import { Chevron, Sheet } from '../../../design/primitives';
import { HAND_LABEL, lineLabel } from '../handLabels';
import { appliedLineBonuses, fmtMult } from '../lineBonuses';
import { BonusCardStrip } from './BonusCardStrip';
import styles from './ScoreDetailsSheet.module.css';

export interface ScoreDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  report: ScoreReport;
  bonusCards: BonusCard[];
  shapley: number[];
  liveContext?: (card: BonusCard) => string[];
}

function LineRow({
  line,
  bonusCards,
  allLines,
}: {
  line: ScoredLine;
  bonusCards: BonusCard[];
  allLines: ScoredLine[];
}) {
  const applied = appliedLineBonuses(line, bonusCards, allLines);
  return (
    <details className={styles.lineRow}>
      <summary className={styles.lineSummary}>
        <Chevron direction="right" size={18} className={styles.caret} />
        <span className={styles.label}>{lineLabel(line.kind, line.index)}</span>
        {line.hand ? (
          <span className={styles.hand}>{HAND_LABEL[line.hand]}</span>
        ) : (
          <span className={`${styles.hand} ${styles.open}`}>
            {line.incomplete ? 'Open' : '—'}
          </span>
        )}
        <span className={styles.pts}>{line.total}</span>
      </summary>
      <div className={styles.lineBody}>
        {line.hand ? (
          <>
            <div className={styles.calcRow}>
              <span>{HAND_LABEL[line.hand]} base</span>
              <span>{line.base}</span>
            </div>
            {applied.map(({ card, mult, flat }, i) => (
              <div key={`${card.id}-${i}`} className={`${styles.calcRow} ${styles.bonus}`}>
                <span>{card.title}</span>
                <span>
                  {mult !== 1 ? fmtMult(mult) : ''}
                  {mult !== 1 && flat !== 0 ? ' ' : ''}
                  {flat !== 0 ? `+${flat}` : ''}
                </span>
              </div>
            ))}
            {applied.length === 0 && (
              <div className={`${styles.calcRow} ${styles.muted}`}>
                <span>No bonus cards fired on this line</span>
              </div>
            )}
          </>
        ) : line.incomplete ? (
          <div className={`${styles.calcRow} ${styles.penalty}`}>
            <span>Unfinished at game end</span>
            <span>{line.total !== 0 ? line.total : INCOMPLETE_LINE_PENALTY}</span>
          </div>
        ) : (
          <div className={`${styles.calcRow} ${styles.muted}`}>
            <span>No scoring hand in this line</span>
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * The end-game details popup: all ten lines up front, each expandable
 * to its computation (base, which bonus cards fired, penalty), then
 * the grid-level totals and the held bonus cards. Bonus chips open
 * their own detail sheet on top — the Dialog primitive's target guard
 * keeps this one open underneath.
 */
export function ScoreDetailsSheet({
  open,
  onClose,
  report,
  bonusCards,
  shapley,
  liveContext,
}: ScoreDetailsSheetProps) {
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} title="Details">
      <div className={styles.body}>
        <div className={styles.lines}>
          {report.lines.map(line => (
            <LineRow
              key={`${line.kind}-${line.index}`}
              line={line}
              bonusCards={bonusCards}
              allLines={report.lines}
            />
          ))}
        </div>

        <div className={styles.totals}>
          <div className={styles.totalsRow}>
            <span>Lines subtotal</span>
            <span>{report.subtotal}</span>
          </div>
          {report.incompletePenalty !== 0 && (
            <div className={`${styles.totalsRow} ${styles.penalty}`}>
              <span>Unfinished lines</span>
              <span>{report.incompletePenalty}</span>
            </div>
          )}
          {report.gridMultiplier !== 1 && (
            <div className={styles.totalsRow}>
              <span>Grid multiplier</span>
              <span>×{report.gridMultiplier.toFixed(2)}</span>
            </div>
          )}
          {report.gridFlat !== 0 && (
            <div className={styles.totalsRow}>
              <span>Grid flat bonus</span>
              <span>+{report.gridFlat}</span>
            </div>
          )}
          <div className={`${styles.totalsRow} ${styles.grand}`}>
            <span>Total</span>
            <span>{report.total}</span>
          </div>
        </div>

        {bonusCards.length > 0 && (
          <BonusCardStrip
            layout="row"
            cards={bonusCards}
            values={shapley}
            liveContext={liveContext}
            hideEach
          />
        )}
      </div>
    </Sheet>
  );
}
