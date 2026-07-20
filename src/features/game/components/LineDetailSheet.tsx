import { BonusCard } from '../../../game/bonusCards';
import { HandRank, evaluatePartialLine } from '../../../game/hands';
import {
  INCOMPLETE_LINE_PENALTY,
  ScoredLine,
  effectiveHandBase,
} from '../../../game/scoring';
import { Sheet } from '../../../design/primitives';
import { HAND_LABEL, lineLabel } from '../handLabels';
import {
  appliedLineBonuses,
  fmtMult,
  hasScoringBonusCards,
  investedBase,
} from '../lineBonuses';
import { LinePotential, cardLineMult } from '../lineInsights';
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
  /**
   * LIVE game only: the line's rail potential (lineInsights). An
   * in-progress line then reads like a completed one — asterisked title
   * ("* C2 — Pair"), the forming hand's base + the yellow cards that
   * would fire on it, and the rail's anticipated value as the total.
   * Result surfaces omit this and keep the final reading.
   */
  potential?: LinePotential | null;
  /** Bull Market's per-hand base raises — the forming base honors them. */
  handBoost?: Partial<Record<HandRank, number>>;
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
  potential = null,
  handBoost,
  onClose,
}: LineDetailSheetProps) {
  const applied = line ? appliedLineBonuses(line, bonusCards, allLines) : [];
  // A live in-progress line with a FORMING hand: the sheet reads like a
  // completed line's calculation, asterisked — it only pays if the line
  // completes. Same math as the rail chip (linePotential).
  const forming =
    line?.incomplete &&
    potential &&
    (potential.tone === 'potential' || potential.tone === 'goldPotential')
      ? potential
      : null;
  // Game over with the line still open: the -25 penalty is IN line.total
  // (live play scores open lines as 0), so this needs no extra prop and
  // holds on every surface — the sheet reads "Incomplete" with the
  // penalty as its red total, no separate warning.
  const dead =
    line !== null && !line.hand && line.incomplete && line.total < 0;
  const formingHand = forming ? evaluatePartialLine(line!.cards) : null;
  const formingBase = formingHand
    ? effectiveHandBase(formingHand, handBoost)
    : 0;
  // The yellow cards that would fire on the forming hand — cardLineMult
  // probes each lineEffect with the partial hand substituted in, exactly
  // how the chip's gold multiplier is built.
  const formingApplied = forming
    ? bonusCards
        .map(card => ({ card, mult: cardLineMult(card, line!, allLines) }))
        .filter(x => x.mult !== 1)
    : [];

  return (
    <Sheet
      open={line !== null}
      onClose={onClose}
      title={
        line
          ? `${forming ? '* ' : ''}${lineLabel(line.kind, line.index)} — ${
              line.hand
                ? HAND_LABEL[line.hand]
                : forming
                  ? forming.name
                  : line.incomplete
                    ? line.cards.some(c => c !== null)
                      ? dead
                        ? 'Incomplete'
                        : 'In Progress'
                      : 'Empty'
                    : 'No hand'
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
            ) : forming ? (
              <>
                {/* Forming hand: the calculation exactly as it would read
                    once the line completes — base + the yellow cards that
                    would fire on it. */}
                <div className={styles.row}>
                  <span className={styles.rowLabel}>{forming.name} base</span>
                  <span>{formingBase}</span>
                </div>
                {formingApplied.map(({ card, mult }, i) => (
                  <div
                    key={`${card.id}-${i}`}
                    className={`${styles.row} ${styles.bonus}`}
                  >
                    <span className={styles.rowLabel}>{card.title}</span>
                    <span>{fmtMult(mult)}</span>
                  </div>
                ))}
                {formingApplied.length === 0 &&
                  hasScoringBonusCards(bonusCards) && (
                    <div className={`${styles.row} ${styles.muted}`}>
                      <span>No bonus cards fire on this line</span>
                    </div>
                  )}
              </>
            ) : line.incomplete ? null : (
              <div className={`${styles.row} ${styles.muted}`}>
                <span>No scoring hand in this line</span>
              </div>
            )}
            <div
              className={`${styles.row} ${styles.total} ${
                dead ? styles.penalty : ''
              }`}
            >
              <span>Line total</span>
              <span>{forming ? forming.value : line.total}</span>
            </div>
            {/* LIVE only — the unfinished stakes below the total: what this
                line costs if it's still open at game end (the leading *
                pairs with the asterisked header — the total above only
                pays if the line completes). Once the game IS over (dead),
                the penalty is simply the red total above. */}
            {!line.hand && line.incomplete && !dead && (
              <div className={`${styles.row} ${styles.penalty}`}>
                <span className={styles.rowLabel}>
                  * Unfinished at game end
                </span>
                <span>{INCOMPLETE_LINE_PENALTY}</span>
              </div>
            )}
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
