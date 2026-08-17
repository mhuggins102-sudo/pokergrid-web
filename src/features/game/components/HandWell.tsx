import { motion } from 'motion/react';
import { isJoker } from '../../../game/cards';
import { HandWellUI } from '../usePhaseUI';
import { CardFace, cardLayoutId } from './CardFace';
import styles from './HandWell.module.css';

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th'];

const cardName = (c: Parameters<typeof CardFace>[0]['card']): string =>
  isJoker(c) ? 'Joker' : `${c.rank} of ${
    { H: 'hearts', S: 'spades', D: 'diamonds', C: 'clubs' }[c.suit]
  }`;

/**
 * Five Draw's dock hand: the five dealt cards, each a toggle button.
 * In 'keep' mode a tap holds/releases the card through the redraw
 * (HOLD chip); in 'place' mode a tap seats it at the leftmost open
 * column of the chosen row (order badge) or takes it back. A staged
 * card renders as an empty outline — its layoutId now lives in the
 * board's preview cell, so the CardFace FLIP-travels dock → grid
 * (jokers have no layoutId and simply appear; acceptable). No header
 * line: the dock banner carries the step instruction, and the slots
 * are square to mirror the grid cells the cards are headed for.
 */
export function HandWell({
  hand,
  compact = false,
}: {
  hand: HandWellUI;
  compact?: boolean;
}) {
  const keepMode = hand.mode === 'keep';
  return (
    <div className={`${styles.well} ${compact ? styles.compact : ''}`}>
      <div className={styles.cards}>
        {hand.cards.map((card, i) => {
          const marked = hand.marked.has(i);
          const order = hand.orderOf(i);
          const staged = !keepMode && order !== null;
          const layoutId = cardLayoutId(card);
          return (
            <button
              key={layoutId ?? `hand-${i}`}
              type="button"
              className={[
                styles.slot,
                marked && keepMode ? styles.held : null,
                staged ? styles.staged : null,
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!hand.tappable(i)}
              aria-pressed={marked}
              aria-label={
                keepMode
                  ? `${cardName(card)}, ${marked ? 'held — tap to release' : 'tap to hold'}`
                  : staged
                    ? `${cardName(card)}, placed ${ORDINAL[order]} — tap to take back`
                    : `${cardName(card)}, tap to place next`
              }
              onClick={() => hand.onCardTap(i)}
            >
              {staged ? (
                // The card itself is previewing on the board — leave an
                // outline so the well keeps its shape.
                <span className={styles.stagedGhost} aria-hidden="true">
                  {ORDINAL[order]}
                </span>
              ) : (
                <motion.div layoutId={layoutId} className={styles.cardBox}>
                  <CardFace card={card} />
                </motion.div>
              )}
              {keepMode && marked && (
                <span className={styles.holdChip} aria-hidden="true">
                  HOLD
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
