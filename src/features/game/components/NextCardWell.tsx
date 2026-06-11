import { AnimatePresence, motion } from 'motion/react';
import { canPreviewDeck } from '../../../game/state';
import { useGameSession } from '../GameSessionProvider';
import { CardFace, cardAriaLabel, cardLayoutId } from './CardFace';
import styles from './NextCardWell.module.css';

export interface NextCardWellProps {
  onPeekDeck: () => void;
  /** Snap (don't animate) layout shifts — used while the dock is
   *  being resized by the ♣ panel. */
  instantLayout?: boolean;
}

/**
 * The drawn-card well — a slim chip that lives in the controls row right
 * under the board, so the card being decided on is never off-screen.
 * Shares motion layoutIds with the grid: placing a card visibly travels
 * from here to its cell.
 */
export function NextCardWell({ onPeekDeck, instantLayout = false }: NextCardWellProps) {
  const { state } = useGameSession();
  const drawn = state.drawn;
  const canPeek = canPreviewDeck(state.difficulty);

  const cardLabel = drawn
    ? `Drawn card: ${cardAriaLabel(drawn)}`
    : 'No card drawn';

  // On Easy/Medium the deck is peekable — tapping the card/deck area is
  // the natural gesture for it, with the Peek link as the discoverable
  // affordance.
  const SlotTag = canPeek ? 'button' : 'div';

  return (
    <div className={styles.well}>
      <SlotTag
        {...(canPeek ? { type: 'button' as const, onClick: onPeekDeck } : {})}
        className={styles.cardSlot}
        aria-label={canPeek ? `${cardLabel}. Peek at the remaining deck` : cardLabel}
      >
        <AnimatePresence>
          {drawn && (
            <motion.div
              key={cardLayoutId(drawn)}
              layoutId={cardLayoutId(drawn)}
              className={styles.cardWrap}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                instantLayout
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 420, damping: 32 }
              }
            >
              <CardFace card={drawn} />
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
