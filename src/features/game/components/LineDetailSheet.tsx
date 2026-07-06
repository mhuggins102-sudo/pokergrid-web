import { BonusCard } from '../../../game/bonusCards';
import { INCOMPLETE_LINE_PENALTY, ScoredLine } from '../../../game/scoring';
import { Sheet } from '../../../design/primitives';
import { HAND_LABEL, lineLabel } from '../handLabels';
import {
  appliedLineBonuses,
  fmtMult,
  hasScoringBonusCards,
  investedBase,
} from '../lineBonuses';
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
  const applied = line ? appliedLineBonuses(line, bonusCards, allLines) : [];

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
                  <span>{investedBase(line).raw}</span>
                </div>
                {/* Bull Market ♣ invests raise the base additively —
                    shown apart from the regular table value. */}
                {investedBase(line).invested > 0 && (
                  <div className={`${styles.row} ${styles.invested}`}>
                    <span className={styles.rowLabel}>♣ Invested</span>
                    <span>+{investedBase(line).invested}</span>
                  </div>
                )}
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
                {/* Placeholder only when the game HAS scoring bonus cards —
                    meaningless in Bull Market / Poker Purist / Three Tricks. */}
                {applied.length === 0 && hasScoringBonusCards(bonusCards) && (
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
                Press{' '}
                <span className={styles.infoGlyph} aria-label="the info button">
                  ⓘ
                </span>{' '}
                to view grid multiplier bonuses that factored into the final
                score.
              </p>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
