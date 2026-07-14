import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Card, Rank, Suit, isJoker, rankIndex } from '../../../game/cards';
import { canPreviewDeck } from '../../../game/state';
import { useTapPopover } from '../../../design/primitives';
import { useGameSession } from '../GameSessionProvider';
import { CardFace, cardAriaLabel, cardLayoutId } from './CardFace';
import styles from './NextCardWell.module.css';

// UI suit tones (theme-aware), matching DeckPreviewDialog's palette.
const SUIT_GLYPH: Record<Suit, string> = { H: '♥', S: '♠', D: '♦', C: '♣' };
const SUIT_TONE: Record<Suit, string> = {
  H: 'var(--suit-h)',
  S: 'var(--suit-s)',
  D: 'var(--suit-d)',
  C: 'var(--suit-c)',
};
// Mockup sort: hearts, spades, diamonds, clubs; rank DESC within a
// suit; jokers last — a fixed order, so the peek never leaks the
// actual deck sequence (same contract as DeckPreviewDialog).
const SUIT_ORDER: Record<Suit, number> = { H: 0, S: 1, D: 2, C: 3 };

interface PeekEntry {
  label: string;
  color: string;
}

const peekEntries = (deck: readonly Card[]): PeekEntry[] => {
  const standard: { rank: Rank; suit: Suit }[] = [];
  let jokers = 0;
  for (const c of deck) {
    if (isJoker(c)) {
      jokers += 1;
      continue;
    }
    standard.push({ rank: c.rank, suit: c.suit });
    // Double Duty: both halves of a two-way card are still available.
    if (c.dual) standard.push({ rank: c.dual.rank, suit: c.dual.suit });
  }
  standard.sort((a, b) =>
    SUIT_ORDER[a.suit] !== SUIT_ORDER[b.suit]
      ? SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]
      : rankIndex(b.rank) - rankIndex(a.rank)
  );
  const out: PeekEntry[] = standard.map(c => ({
    label: `${c.rank}${SUIT_GLYPH[c.suit]}`,
    color: SUIT_TONE[c.suit],
  }));
  for (let i = 0; i < jokers; i++) {
    out.push({ label: '★', color: 'var(--joker)' });
  }
  return out;
};

export interface NextCardWellProps {
  onPeekDeck: () => void;
  /** Snap (don't animate) layout shifts — used while the dock is
   *  being resized by the ♣ panel. */
  instantLayout?: boolean;
  /** Hand-stack dock: hero-size card with the meta line beneath. */
  stacked?: boolean;
  /** Deck-count caption: 'left' ("12 left", the mobile docks) or
   *  'deck' ("Deck · 12", the desktop rail panel per the mockup). */
  meta?: 'left' | 'deck';
  /**
   * How the deck peek surfaces. 'dialog' (default — mobile behavior,
   * unchanged): tapping the card / Peek link calls onPeekDeck to open
   * DeckPreviewDialog. 'hover' (desktop): no dialog — hovering or
   * focusing the well shows the mockup's side popover listing every
   * remaining card. Nothing renders when the difficulty forbids
   * deck preview.
   */
  peek?: 'dialog' | 'hover';
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
  meta = 'left',
  peek = 'dialog',
  flight = null,
}: NextCardWellProps) {
  const { state } = useGameSession();
  const drawn = state.drawn;
  const canPeek = canPreviewDeck(state.difficulty);
  const hoverPeek = peek === 'hover' && canPeek;
  // Touch tap-toggle for the hover-peek popover (decision E). On desk
  // tiers this is the ONLY touch affordance for a deck peek — the desk
  // dock passes a no-op onPeekDeck (no dialog), so without this a coarse
  // pointer could never see the remaining deck. Only wired for the hover
  // variant; the mobile dialog well keeps its own onClick.
  const peekPop = useTapPopover('deck-peek');

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

  // Hover-peek: the remaining deck as sorted "rank+glyph" chips in the
  // side popover. Only computed when that popover can actually show.
  const entries = useMemo(
    () => (hoverPeek ? peekEntries(state.deck) : []),
    [hoverPeek, state.deck]
  );

  // On Easy/Medium the deck is peekable — on mobile, tapping the
  // card/deck area opens the dialog (the Peek link is the discoverable
  // affordance); on desktop the hover popover replaces both.
  const dialogPeek = canPeek && peek === 'dialog';
  const SlotTag = dialogPeek ? 'button' : 'div';

  return (
    <div
      className={[
        styles.well,
        stacked ? styles.stacked : null,
        hoverPeek ? styles.peekWrap : null,
        hoverPeek && peekPop.open ? styles.peekWrapOpen : null,
      ]
        .filter(Boolean)
        .join(' ')}
      {...(hoverPeek
        ? { tabIndex: 0, ref: peekPop.wrapRef, ...peekPop.toggleProps }
        : {})}
    >
      <SlotTag
        {...(dialogPeek ? { type: 'button' as const, onClick: onPeekDeck } : {})}
        className={styles.cardSlot}
        aria-label={
          dialogPeek ? `${cardLabel}. Peek at the remaining deck` : cardLabel
        }
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
        <span className={styles.deckCount}>
          {meta === 'deck'
            ? `Deck · ${state.deck.length}`
            : `${state.deck.length} left`}
        </span>
        {dialogPeek && (
          <button type="button" className={styles.peek} onClick={onPeekDeck}>
            Peek
          </button>
        )}
      </div>
      {hoverPeek && (
        <div className={styles.peekPop} role="tooltip">
          <span className={styles.peekHead}>
            Deck peek · {state.deck.length} left
          </span>
          <div className={styles.peekCards}>
            {entries.map((e, i) => (
              <span key={i} style={{ color: e.color }}>
                {e.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
