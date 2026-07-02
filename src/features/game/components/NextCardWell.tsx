import { AnimatePresence, motion } from 'motion/react';
import { Card } from '../../../game/cards';
import { canPreviewDeck } from '../../../game/state';
import { useGameSession } from '../GameSessionProvider';
import { CardFace, cardAriaLabel, cardLayoutId } from './CardFace';
import styles from './NextCardWell.module.css';

export interface NextCardWellProps {
  onPeekDeck: () => void;
  /** Snap (don't animate) layout shifts — used while the dock is
   *  being resized by the ♣ panel. */
  instantLayout?: boolean;
  /** Hand-stack dock: hero-size card with the meta line beneath. */
  stacked?: boolean;
  /**
   * Auto-place staging (useAutoPlaceFlights): while set, this card
   * poses here INSTEAD of the drawn card; on release the grid cell
   * takes over its layoutId and the card visibly flies to its slot.
   */
  flight?: { card: Card; layoutId: string } | null;
}

/**
 * The drawn-card well — a slim chip that lives in the controls row right
 * under the board, so the card being decided on is never off-screen.
 * Shares motion layoutIds with the grid: placing a card visibly travels
 * from here to its cell.
 */
export function NextCardWell({
  onPeekDeck,
  instantLayout = false,
  stacked = false,
  flight = null,
}: NextCardWellProps) {
  const { state } = useGameSession();
  const drawn = state.drawn;
  const canPeek = canPreviewDeck(state.difficulty);

  const shown = flight ? flight.card : drawn;
  const shownLayoutId = flight
    ? flight.layoutId
    : drawn
      ? cardLayoutId(drawn)
      : undefined;

  // Double Duty: a flip swaps the drawn card's rank/suit, which changes
  // the element key — the fresh element enters rotated a half-turn and
  // settles to 0, reading as the physical 180° rotation (the two-way
  // face is printed so both orientations are coherent). flippedDrawn
  // resets on the next draw, so ordinary draws keep the drop-in entrance.
  const flipEntrance = !flight && state.flippedDrawn;

  const cardLabel = flight
    ? `Auto-placing: ${cardAriaLabel(flight.card)}`
    : drawn
      ? `Drawn card: ${cardAriaLabel(drawn)}`
      : 'No card drawn';

  // On Easy/Medium the deck is peekable — tapping the card/deck area is
  // the natural gesture for it, with the Peek link as the discoverable
  // affordance.
  const SlotTag = canPeek ? 'button' : 'div';

  return (
    <div className={`${styles.well}${stacked ? ` ${styles.stacked}` : ''}`}>
      <SlotTag
        {...(canPeek ? { type: 'button' as const, onClick: onPeekDeck } : {})}
        className={styles.cardSlot}
        aria-label={canPeek ? `${cardLabel}. Peek at the remaining deck` : cardLabel}
      >
        <AnimatePresence>
          {shown && (
            <motion.div
              key={shownLayoutId}
              layoutId={instantLayout ? undefined : shownLayoutId}
              className={styles.cardWrap}
              initial={
                flipEntrance
                  ? { opacity: 1, y: 0, rotate: -180 }
                  : { opacity: 0, y: -10, rotate: 0 }
              }
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={
                instantLayout
                  ? { duration: 0 }
                  : flipEntrance
                    ? { type: 'spring', stiffness: 260, damping: 24 }
                    : { type: 'spring', stiffness: 420, damping: 32 }
              }
            >
              <CardFace card={shown} />
            </motion.div>
          )}
        </AnimatePresence>
      </SlotTag>
      <div className={styles.meta}>
        <span className={styles.deckCount}>{state.deck.length} left</span>
        {canPeek && (
          <button type="button" className={styles.peek} onClick={onPeekDeck}>
            Peek
          </button>
        )}
      </div>
    </div>
  );
}
