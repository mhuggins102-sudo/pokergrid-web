import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Card, isJoker } from '../../../game/cards';
import { HandWellUI } from '../usePhaseUI';
import { prefersReducedMotion } from '../useAnimatedNumber';
import { useSettingsStore } from '../../settings/settingsStore';
import { CardFace, cardLayoutId } from './CardFace';
import styles from './HandWell.module.css';

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th'];

const cardName = (c: Parameters<typeof CardFace>[0]['card']): string =>
  isJoker(c) ? 'Joker' : `${c.rank} of ${
    { H: 'hearts', S: 'spades', D: 'diamonds', C: 'clubs' }[c.suit]
  }`;

// Slot-level identity for the reveal diff. Every physical card exists
// once, so rank+suit is unique; twin jokers can alias each other in a
// slot (2-joker easy dailies) — worst case one replacement skips its
// flip-in, cosmetic only.
const cardKeyOf = (c: Card): string =>
  isJoker(c) ? 'joker' : `${c.rank}${c.suit}`;

/** Seconds between one card's flip-in and the next. */
const REVEAL_STAGGER = 0.11;

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
 *
 * Cards ARRIVE one at a time: a fresh deal reveals all five left to
 * right, a redraw reveals only the replacements (held cards never
 * blink) — each newcomer mounts hidden and flips in on a stagger.
 * Purely presentational; the reducer dealt them all in one action.
 */
export function HandWell({
  hand,
  compact = false,
}: {
  hand: HandWellUI;
  compact?: boolean;
}) {
  const keepMode = hand.mode === 'keep';
  const reduceMotion =
    useSettingsStore(s => s.reduceMotion) || prefersReducedMotion();

  // Which slots hold a card that wasn't there on the previous render?
  // A new handNo marks all five fresh (a placed card can't reappear,
  // but the blanket rule also covers the twin-joker alias); within a
  // hand, a changed slot identity marks the redraw's replacements.
  const keys = hand.cards.map(cardKeyOf);
  const prevRef = useRef<{ handNo: number; keys: string[] } | null>(null);
  const prev = prevRef.current;
  const freshSlots = hand.cards
    .map((_, i) => i)
    .filter(
      i => !prev || prev.handNo !== hand.handNo || prev.keys[i] !== keys[i]
    );
  useEffect(() => {
    prevRef.current = { handNo: hand.handNo, keys };
  });

  return (
    <div className={`${styles.well} ${compact ? styles.compact : ''}`}>
      <div className={styles.cards}>
        {hand.cards.map((card, i) => {
          const marked = hand.marked.has(i);
          const order = hand.orderOf(i);
          const staged = !keepMode && order !== null;
          const layoutId = cardLayoutId(card);
          // Position among this render's newcomers → the stagger seat.
          const revealAt = freshSlots.indexOf(i);
          const fresh = revealAt >= 0 && !reduceMotion;
          return (
            <button
              // handNo in the joker fallback: a joker's slot remounts on
              // the next deal, so its reveal runs like everyone else's.
              key={layoutId ?? `hand-${hand.handNo}-${i}`}
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
                <motion.div
                  layoutId={layoutId}
                  className={styles.cardBox}
                  // A newcomer mounts hidden and flips face-up at its
                  // stagger seat; everything else (held cards, a card
                  // taken back from the board) keeps default motion so
                  // the layoutId return-FLIP isn't delayed.
                  initial={fresh ? { opacity: 0, rotateY: 90 } : false}
                  animate={{ opacity: 1, rotateY: 0 }}
                  transition={
                    fresh
                      ? { duration: 0.18, delay: revealAt * REVEAL_STAGGER }
                      : undefined
                  }
                >
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
