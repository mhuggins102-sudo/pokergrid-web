import { BonusCard, LineContext, isPlaceholder, isSpecialCard } from '../../../game/bonusCards';
import { INCOMPLETE_LINE_PENALTY, ScoredLine } from '../../../game/scoring';
import { Sheet } from '../../../design/primitives';
import { HAND_LABEL, lineLabel } from '../handLabels';
import { CardFace } from './CardFace';
import styles from './LineDetailSheet.module.css';

export interface LineDetailSheetProps {
  line: ScoredLine | null;
  bonusCards: BonusCard[];
  /** Full set of scored lines — cross-line bonus cards need it. */
  allLines: ScoredLine[];
  /**
   * True when grid-level bonuses (Speedrun, grid achievements…) changed
   * the final total — they don't belong to any one line, so the sheet
   * points the reader at Score math instead of leaving the multiplier
   * unaccounted for.
   */
  gridBonusesApplied?: boolean;
  onClose: () => void;
}

const fmtMult = (m: number): string => {
  const s = m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `×${s}`;
};

/**
 * The calculation behind one line: its five cards, the hand, and
 * exactly which bonus cards fired on it (re-deriving each card's
 * lineEffect against this line).
 */
export function LineDetailSheet({
  line,
  bonusCards,
  allLines,
  gridBonusesApplied = false,
  onClose,
}: LineDetailSheetProps) {
  const applied =
    line && line.hand
      ? bonusCards
          .filter(c => !isPlaceholder(c) && !isSpecialCard(c) && c.lineEffect)
          .map(card => {
            const eff = card.lineEffect!(line as LineContext, card, allLines);
            return { card, mult: eff.multiplier ?? 1, flat: eff.flatAdd ?? 0 };
          })
          .filter(e => e.mult !== 1 || e.flat !== 0)
      : [];

  return (
    <Sheet
      open={line !== null}
      onClose={onClose}
      title={
        line
          ? `${lineLabel(line.kind, line.index)} — ${
              line.hand ? HAND_LABEL[line.hand] : line.incomplete ? 'Open line' : 'No hand'
            }`
          : ''
      }
    >
      {line && (
        <div className={styles.body}>
          <div className={styles.cards}>
            {line.cards.map((card, i) =>
              card ? (
                <div key={i} className={styles.cardCell}>
                  <CardFace card={card} />
                </div>
              ) : (
                <div key={i} className={styles.emptyCell} />
              )
            )}
          </div>

          <div className={styles.math}>
            {line.hand ? (
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>
                    {HAND_LABEL[line.hand]} base
                  </span>
                  <span>{line.base}</span>
                </div>
                {applied.map(({ card, mult, flat }, i) => (
                  <div key={`${card.id}-${i}`} className={`${styles.row} ${styles.bonus}`}>
                    {/* title, not name — names carry "×N (each)" suffixes
                        that would double up with the computed value. */}
                    <span className={styles.rowLabel}>{card.title}</span>
                    <span>
                      {mult !== 1 ? fmtMult(mult) : ''}
                      {mult !== 1 && flat !== 0 ? ' ' : ''}
                      {flat !== 0 ? `+${flat}` : ''}
                    </span>
                  </div>
                ))}
                {applied.length === 0 && (
                  <div className={`${styles.row} ${styles.muted}`}>
                    <span>No bonus cards fired on this line</span>
                  </div>
                )}
              </>
            ) : line.incomplete ? (
              <div className={`${styles.row} ${styles.penalty}`}>
                <span className={styles.rowLabel}>
                  Unfinished at game end
                </span>
                <span>{line.total !== 0 ? line.total : INCOMPLETE_LINE_PENALTY}</span>
              </div>
            ) : (
              <div className={`${styles.row} ${styles.muted}`}>
                <span>No scoring hand in this line</span>
              </div>
            )}
            <div className={`${styles.row} ${styles.total}`}>
              <span>Line total</span>
              <span>{line.total}</span>
            </div>
            {gridBonusesApplied && (
              <p className={styles.gridNote}>
                Grid-level bonuses also multiplied the final total at game
                end — see Score math.
              </p>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
